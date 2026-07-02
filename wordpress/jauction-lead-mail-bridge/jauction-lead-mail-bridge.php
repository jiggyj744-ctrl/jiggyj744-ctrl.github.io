<?php
/**
 * Plugin Name: Jauction Lead Mail Bridge
 * Description: Receives Jauction landing leads through a protected REST endpoint and sends email through wp_mail/WP Mail SMTP.
 * Version: 1.0.2
 * Author: Jauction
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Update URI: false
 */

if (!defined('ABSPATH')) {
    exit;
}

const JAUCTION_LEAD_MAIL_TO = 'jauction_lead_mail_to';
const JAUCTION_LEAD_MAIL_TOKEN = 'jauction_lead_mail_token';
const JAUCTION_LEAD_MAIL_FROM_NAME = 'jauction_lead_mail_from_name';
const JAUCTION_LEAD_MAIL_FROM_EMAIL = 'jauction_lead_mail_from_email';
const JAUCTION_LEAD_MAIL_LAST_STATUS = 'jauction_lead_mail_last_status';
const JAUCTION_LEAD_MAIL_LAST_ERROR = 'jauction_lead_mail_last_error';
const JAUCTION_LEAD_MAIL_LAST_AT = 'jauction_lead_mail_last_at';
const JAUCTION_LEAD_MAIL_SETTINGS_VERSION = 'jauction_lead_mail_settings_version';
const JAUCTION_LEAD_MAIL_CONSULTATION_TOKEN = 'SHARE-CONSULTATION-CUSTOMER-FORM';
const JAUCTION_LEAD_MAIL_FILTER_PRIORITY = 9999;
const JAUCTION_LEAD_MAIL_PLUGIN_VERSION = '1.0.2';
const JAUCTION_LEAD_MAIL_FALLBACK_FROM_EMAIL = 'jiggyj@naver.com';

register_activation_hook(__FILE__, 'jauction_lead_mail_ensure_defaults');
add_action('plugins_loaded', 'jauction_lead_mail_ensure_defaults');
add_action('rest_api_init', 'jauction_lead_mail_register_routes');
add_action('admin_menu', 'jauction_lead_mail_admin_menu');

function jauction_lead_mail_ensure_defaults(): void
{
    if (!get_option(JAUCTION_LEAD_MAIL_TO)) {
        update_option(JAUCTION_LEAD_MAIL_TO, jauction_lead_mail_default_recipient());
    }
    if (!get_option(JAUCTION_LEAD_MAIL_FROM_NAME)) {
        update_option(JAUCTION_LEAD_MAIL_FROM_NAME, jauction_lead_mail_default_from_name());
    }
    if (!get_option(JAUCTION_LEAD_MAIL_FROM_EMAIL)) {
        $from_email = jauction_lead_mail_default_from_email();
        if ($from_email !== '') {
            update_option(JAUCTION_LEAD_MAIL_FROM_EMAIL, $from_email);
        }
    }
    jauction_lead_mail_migrate_sender_defaults();
    $external_token = jauction_lead_mail_external_token();
    if ($external_token !== '') {
        if ((string) get_option(JAUCTION_LEAD_MAIL_TOKEN, '') !== $external_token) {
            update_option(JAUCTION_LEAD_MAIL_TOKEN, $external_token);
        }
    } elseif (!get_option(JAUCTION_LEAD_MAIL_TOKEN)) {
        update_option(JAUCTION_LEAD_MAIL_TOKEN, wp_generate_password(40, false, false));
    }
}

function jauction_lead_mail_default_recipient(): string
{
    $configured = getenv('INQUIRY_RECIPIENT_EMAIL');
    return sanitize_text_field($configured ?: get_option('admin_email'));
}

function jauction_lead_mail_default_from_name(): string
{
    $configured = getenv('SMTP_FROM_NAME');
    return sanitize_text_field($configured ?: '지분매입 상담센터');
}

function jauction_lead_mail_default_from_email(): string
{
    $configured = getenv('JAUCTION_LEAD_MAIL_FROM_EMAIL') ?: getenv('SMTP_FROM_EMAIL');
    $email = sanitize_email((string) $configured);
    if ($email && is_email($email)) {
        return $email;
    }

    $admin_email = sanitize_email((string) get_option('admin_email'));
    if ($admin_email && is_email($admin_email) && !jauction_lead_mail_is_legacy_sender($admin_email)) {
        return $admin_email;
    }

    return JAUCTION_LEAD_MAIL_FALLBACK_FROM_EMAIL;
}

function jauction_lead_mail_migrate_sender_defaults(): void
{
    $stored_version = (string) get_option(JAUCTION_LEAD_MAIL_SETTINGS_VERSION, '');
    $from_email = sanitize_email((string) get_option(JAUCTION_LEAD_MAIL_FROM_EMAIL, ''));
    if ($stored_version === JAUCTION_LEAD_MAIL_PLUGIN_VERSION && !jauction_lead_mail_is_legacy_sender($from_email)) {
        return;
    }

    if ($from_email === '' || jauction_lead_mail_is_legacy_sender($from_email)) {
        update_option(JAUCTION_LEAD_MAIL_FROM_EMAIL, jauction_lead_mail_default_from_email());
    }
    update_option(JAUCTION_LEAD_MAIL_FROM_NAME, '지분매입 상담센터');
    update_option(JAUCTION_LEAD_MAIL_SETTINGS_VERSION, JAUCTION_LEAD_MAIL_PLUGIN_VERSION);
}

function jauction_lead_mail_is_legacy_sender(string $email): bool
{
    $value = strtolower(trim($email));
    return $value !== '' && strpos($value, '@factorypro.co.kr') !== false;
}

function jauction_lead_mail_external_token(): string
{
    $token = getenv('JAUCTION_LEAD_MAIL_TOKEN');
    if (is_string($token) && $token !== '') {
        return sanitize_text_field($token);
    }

    $token_files = [
        trailingslashit(WPMU_PLUGIN_DIR) . 'jauction-lead-mail-bridge-token.php',
        trailingslashit(__DIR__) . 'jauction-lead-mail-bridge-token.php',
    ];
    foreach ($token_files as $token_file) {
        if (is_readable($token_file)) {
            $loaded = include $token_file;
            if (is_string($loaded) && $loaded !== '') {
                return sanitize_text_field($loaded);
            }
        }
    }

    return '';
}

function jauction_lead_mail_register_routes(): void
{
    register_rest_route('jauction/v1', '/lead', [
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'jauction_lead_mail_rest_lead',
        'permission_callback' => 'jauction_lead_mail_permission',
    ]);
}

function jauction_lead_mail_permission(WP_REST_Request $request)
{
    $configured = jauction_lead_mail_current_token();
    if ($configured === '') {
        return new WP_Error('jauction_token_missing', 'Bridge token is not configured.', ['status' => 403]);
    }

    $received = jauction_lead_mail_request_token($request);
    if ($received === '' || !hash_equals($configured, $received)) {
        return new WP_Error('jauction_forbidden', 'Invalid bridge token.', ['status' => 403]);
    }

    return true;
}

function jauction_lead_mail_request_token(WP_REST_Request $request): string
{
    $token = (string) $request->get_header('x-jauction-token');
    if ($token !== '') {
        return trim($token);
    }

    $authorization = (string) $request->get_header('authorization');
    if (preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
        return trim($matches[1]);
    }

    return '';
}

function jauction_lead_mail_current_token(): string
{
    return jauction_lead_mail_external_token() ?: (string) get_option(JAUCTION_LEAD_MAIL_TOKEN, '');
}

function jauction_lead_mail_rest_lead(WP_REST_Request $request)
{
    $params = $request->get_json_params();
    if (!is_array($params)) {
        return new WP_Error('jauction_invalid_json', 'Invalid JSON payload.', ['status' => 400]);
    }

    $lead = jauction_lead_mail_sanitize_lead($params);
    if ($lead['event'] !== '' && $lead['event'] !== 'lead.created') {
        return new WP_Error('jauction_invalid_event', 'Unsupported event.', ['status' => 400]);
    }
    if ($lead['name'] === '' || $lead['phone'] === '' || $lead['case_or_address'] === '') {
        return new WP_Error('jauction_required_field', 'Name, phone, and case_or_address are required.', ['status' => 400]);
    }

    $result = jauction_lead_mail_send($lead);
    if (!$result['ok']) {
        return new WP_REST_Response([
            'ok' => false,
            'mail_sent' => false,
            'error' => $result['error'],
        ], 500);
    }

    return new WP_REST_Response([
        'ok' => true,
        'mail_sent' => true,
    ], 200);
}

function jauction_lead_mail_sanitize_lead(array $params): array
{
    return [
        'event' => jauction_lead_mail_clean($params['event'] ?? '', 80),
        'id' => jauction_lead_mail_clean($params['id'] ?? '', 80),
        'created_at' => jauction_lead_mail_clean($params['created_at'] ?? '', 120),
        'name' => jauction_lead_mail_clean($params['name'] ?? '', 120),
        'phone' => jauction_lead_mail_clean($params['phone'] ?? '', 80),
        'email' => jauction_lead_mail_clean_email($params['email'] ?? ''),
        'type' => jauction_lead_mail_clean($params['type'] ?? '', 160),
        'case_or_address' => jauction_lead_mail_clean($params['case_or_address'] ?? '', 500),
        'share' => jauction_lead_mail_clean($params['share'] ?? '', 80),
        'owners' => jauction_lead_mail_clean($params['owners'] ?? '', 80),
        'status' => jauction_lead_mail_clean($params['status'] ?? '', 160),
        'message' => jauction_lead_mail_clean_textarea($params['message'] ?? '', 2000),
        'source' => esc_url_raw((string) ($params['source'] ?? '')),
    ];
}

function jauction_lead_mail_clean($value, int $limit): string
{
    return jauction_lead_mail_limit(sanitize_text_field((string) $value), $limit);
}

function jauction_lead_mail_clean_textarea($value, int $limit): string
{
    return jauction_lead_mail_limit(sanitize_textarea_field((string) $value), $limit);
}

function jauction_lead_mail_clean_email($value): string
{
    $email = sanitize_email((string) $value);
    return $email && is_email($email) ? $email : '';
}

function jauction_lead_mail_limit(string $value, int $limit): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $limit);
    }
    return substr($value, 0, $limit);
}

function jauction_lead_mail_send(array $lead): array
{
    $to = jauction_lead_mail_recipients();
    if (!$to) {
        return jauction_lead_mail_record_result(false, 'recipient_not_configured');
    }

    $subject = jauction_lead_mail_subject($lead);
    $body = jauction_lead_mail_body($lead);
    $headers = [
        'Content-Type: text/plain; charset=UTF-8',
        'X-Jauction-Mail: lead-notification',
        'X-ShareConsult-Mail: customer-inquiry',
        'X-ShareConsult-Form: shared-interest-consultation',
        'X-ShareConsult-Mail-Token: ' . JAUCTION_LEAD_MAIL_CONSULTATION_TOKEN,
    ];
    $from_email = jauction_lead_mail_configured_from_email();
    if ($from_email !== '') {
        $headers[] = 'From: ' . jauction_lead_mail_format_mailbox($from_email, jauction_lead_mail_configured_from_name());
    }
    if ($lead['email'] !== '') {
        $headers[] = 'Reply-To: ' . jauction_lead_mail_format_mailbox($lead['email'], $lead['name']);
    }

    $GLOBALS['jauction_lead_mail_last_wp_error'] = '';
    add_action('wp_mail_failed', 'jauction_lead_mail_capture_wp_error');
    add_filter('wp_mail_from', 'jauction_lead_mail_from_email', JAUCTION_LEAD_MAIL_FILTER_PRIORITY);
    add_filter('wp_mail_from_name', 'jauction_lead_mail_from_name', JAUCTION_LEAD_MAIL_FILTER_PRIORITY);

    $sent = wp_mail($to, $subject, $body, $headers);

    remove_filter('wp_mail_from_name', 'jauction_lead_mail_from_name', JAUCTION_LEAD_MAIL_FILTER_PRIORITY);
    remove_filter('wp_mail_from', 'jauction_lead_mail_from_email', JAUCTION_LEAD_MAIL_FILTER_PRIORITY);
    remove_action('wp_mail_failed', 'jauction_lead_mail_capture_wp_error');

    if (!$sent) {
        $error = (string) ($GLOBALS['jauction_lead_mail_last_wp_error'] ?? '');
        return jauction_lead_mail_record_result(false, $error ?: 'wp_mail_returned_false');
    }

    return jauction_lead_mail_record_result(true, '');
}

function jauction_lead_mail_body(array $lead): string
{
    return implode("\n", [
        '내부 식별값: ' . JAUCTION_LEAD_MAIL_CONSULTATION_TOKEN,
        '메일 유형: 고객 상담신청 폼 전송',
        '',
        '지분매입 상담 신청이 접수되었습니다.',
        '',
        '접수번호: ' . ($lead['id'] ?: '-'),
        '접수시각: ' . ($lead['created_at'] ?: current_time('mysql')),
        '이름: ' . ($lead['name'] ?: '-'),
        '연락처: ' . ($lead['phone'] ?: '-'),
        '이메일: ' . ($lead['email'] ?: '-'),
        '상담유형: ' . ($lead['type'] ?: '-'),
        '주소/사건번호: ' . ($lead['case_or_address'] ?: '-'),
        '지분율: ' . ($lead['share'] ?: '-'),
        '공유자 수: ' . ($lead['owners'] ?: '-'),
        '현재 상태: ' . ($lead['status'] ?: '-'),
        '출처: ' . ($lead['source'] ?: '-'),
        '',
        '상담 내용:',
        $lead['message'] ?: '-',
    ]);
}

function jauction_lead_mail_subject(array $lead): string
{
    $type = $lead['type'] ?: '공유지분 검토';
    $name = $lead['name'] ?: '이름 미기재';
    $item = $lead['case_or_address'] ?: '주소/사건번호 미기재';
    return sprintf('[지분매입 상담신청][SHARE-CONSULTATION] %s - %s / %s', $type, $name, $item);
}

function jauction_lead_mail_recipients(): array
{
    $raw = (string) get_option(JAUCTION_LEAD_MAIL_TO, get_option('admin_email'));
    $parts = preg_split('/[\s,;]+/', $raw);
    $emails = [];
    foreach ($parts as $part) {
        $email = sanitize_email($part);
        if ($email && is_email($email)) {
            $emails[] = $email;
        }
    }
    return array_values(array_unique($emails));
}

function jauction_lead_mail_from_name(string $name): string
{
    $configured = jauction_lead_mail_configured_from_name();
    return $configured ?: $name;
}

function jauction_lead_mail_from_email(string $email): string
{
    $configured = jauction_lead_mail_configured_from_email();
    return $configured && is_email($configured) ? $configured : $email;
}

function jauction_lead_mail_configured_from_name(): string
{
    return sanitize_text_field((string) get_option(JAUCTION_LEAD_MAIL_FROM_NAME, '지분매입 상담센터'));
}

function jauction_lead_mail_configured_from_email(): string
{
    $configured = sanitize_email((string) get_option(JAUCTION_LEAD_MAIL_FROM_EMAIL, ''));
    if ($configured && is_email($configured) && !jauction_lead_mail_is_legacy_sender($configured)) {
        return $configured;
    }
    return jauction_lead_mail_default_from_email();
}

function jauction_lead_mail_format_mailbox(string $email, string $name): string
{
    $safe_email = sanitize_email($email);
    $safe_name = trim(str_replace(["\r", "\n"], '', sanitize_text_field($name)));
    return $safe_name !== '' ? sprintf('%s <%s>', $safe_name, $safe_email) : $safe_email;
}

function jauction_lead_mail_capture_wp_error(WP_Error $error): void
{
    $GLOBALS['jauction_lead_mail_last_wp_error'] = $error->get_error_message();
}

function jauction_lead_mail_record_result(bool $ok, string $error): array
{
    update_option(JAUCTION_LEAD_MAIL_LAST_STATUS, $ok ? 'sent' : 'failed');
    update_option(JAUCTION_LEAD_MAIL_LAST_ERROR, $error);
    update_option(JAUCTION_LEAD_MAIL_LAST_AT, current_time('mysql'));

    return [
        'ok' => $ok,
        'error' => $error,
    ];
}

function jauction_lead_mail_admin_menu(): void
{
    add_options_page(
        'Jauction Mail Bridge',
        'Jauction Mail',
        'manage_options',
        'jauction-lead-mail',
        'jauction_lead_mail_admin_page'
    );
}

function jauction_lead_mail_admin_page(): void
{
    if (!current_user_can('manage_options')) {
        return;
    }

    jauction_lead_mail_handle_admin_post();

    $endpoint = esc_url(rest_url('jauction/v1/lead'));
    $token = esc_html(jauction_lead_mail_current_token());
    $to = esc_attr((string) get_option(JAUCTION_LEAD_MAIL_TO, get_option('admin_email')));
    $from_name = esc_attr((string) get_option(JAUCTION_LEAD_MAIL_FROM_NAME, '지분매입 상담센터'));
    $from_email = esc_attr((string) get_option(JAUCTION_LEAD_MAIL_FROM_EMAIL, ''));
    $effective_from_email = esc_html(jauction_lead_mail_configured_from_email());
    $effective_from_name = esc_html(jauction_lead_mail_configured_from_name());
    $legacy_from_warning = jauction_lead_mail_is_legacy_sender((string) get_option(JAUCTION_LEAD_MAIL_FROM_EMAIL, ''));
    $last_status = esc_html((string) get_option(JAUCTION_LEAD_MAIL_LAST_STATUS, '-'));
    $last_error = esc_html((string) get_option(JAUCTION_LEAD_MAIL_LAST_ERROR, ''));
    $last_at = esc_html((string) get_option(JAUCTION_LEAD_MAIL_LAST_AT, '-'));
    ?>
    <div class="wrap">
        <h1>Jauction Mail Bridge</h1>
        <?php settings_errors('jauction_lead_mail'); ?>
        <p>Cloudflare Worker 상담 접수를 WordPress <code>wp_mail()</code>로 전달합니다. WP Mail SMTP가 설정되어 있으면 그 발송 경로를 그대로 사용합니다.</p>

        <table class="widefat striped" style="max-width: 980px;">
            <tbody>
                <tr>
                    <th scope="row" style="width: 220px;">REST Endpoint</th>
                    <td><code><?php echo $endpoint; ?></code></td>
                </tr>
                <tr>
                    <th scope="row">Worker Secret Token</th>
                    <td><code style="word-break: break-all;"><?php echo $token; ?></code></td>
                </tr>
                <tr>
                    <th scope="row">마지막 발송 상태</th>
                    <td><?php echo $last_status; ?> / <?php echo $last_at; ?><?php echo $last_error ? ' / ' . $last_error : ''; ?></td>
                </tr>
                <tr>
                    <th scope="row">적용 발신자</th>
                    <td>
                        <code><?php echo $effective_from_name; ?> &lt;<?php echo $effective_from_email; ?>&gt;</code>
                        <?php if ($legacy_from_warning) : ?>
                            <p style="color:#b32d2e;margin:8px 0 0;">기존 발신 주소가 이전 사이트 도메인으로 감지되어 지분매입 기본 발신자로 보정됩니다.</p>
                        <?php endif; ?>
                    </td>
                </tr>
            </tbody>
        </table>

        <form method="post" style="max-width: 760px; margin-top: 24px;">
            <?php wp_nonce_field('jauction_lead_mail_save'); ?>
            <input type="hidden" name="jauction_lead_mail_action" value="save">
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="jauction_lead_mail_to">수신 이메일</label></th>
                    <td>
                        <input name="jauction_lead_mail_to" id="jauction_lead_mail_to" type="text" class="regular-text" value="<?php echo $to; ?>">
                        <p class="description">여러 개는 쉼표로 구분합니다.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="jauction_lead_mail_from_name">발신자 이름</label></th>
                    <td>
                        <input name="jauction_lead_mail_from_name" id="jauction_lead_mail_from_name" type="text" class="regular-text" value="<?php echo $from_name; ?>">
                        <p class="description">메일함에 표시될 발신자 이름입니다.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="jauction_lead_mail_from_email">발신자 이메일</label></th>
                    <td>
                        <input name="jauction_lead_mail_from_email" id="jauction_lead_mail_from_email" type="email" class="regular-text" value="<?php echo $from_email; ?>" placeholder="예: jiggyj@naver.com">
                        <p class="description">현재 기본값은 <?php echo esc_html(JAUCTION_LEAD_MAIL_FALLBACK_FROM_EMAIL); ?>입니다. WP Mail SMTP가 강제 발신 주소를 사용하면 SMTP 설정이 우선될 수 있습니다.</p>
                        <p class="description">무료 github.io 주소는 메일 발신 도메인으로 인증할 수 없습니다. 전용 도메인을 연결하면 no-reply@전용도메인 같은 인증 주소로 바꾸세요.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('설정 저장'); ?>
        </form>

        <form method="post" style="display: inline-block; margin-right: 8px;">
            <?php wp_nonce_field('jauction_lead_mail_test'); ?>
            <input type="hidden" name="jauction_lead_mail_action" value="test">
            <?php submit_button('테스트 메일 보내기', 'secondary', 'submit', false); ?>
        </form>

        <form method="post" style="display: inline-block;">
            <?php wp_nonce_field('jauction_lead_mail_rotate'); ?>
            <input type="hidden" name="jauction_lead_mail_action" value="rotate">
            <?php submit_button('토큰 재발급', 'secondary', 'submit', false); ?>
        </form>
    </div>
    <?php
}

function jauction_lead_mail_handle_admin_post(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        return;
    }

    $action = sanitize_text_field((string) ($_POST['jauction_lead_mail_action'] ?? ''));
    if ($action === 'save') {
        check_admin_referer('jauction_lead_mail_save');
        update_option(JAUCTION_LEAD_MAIL_TO, sanitize_text_field((string) ($_POST['jauction_lead_mail_to'] ?? '')));
        update_option(JAUCTION_LEAD_MAIL_FROM_NAME, sanitize_text_field((string) ($_POST['jauction_lead_mail_from_name'] ?? '')));
        $from_email = sanitize_email((string) ($_POST['jauction_lead_mail_from_email'] ?? ''));
        update_option(JAUCTION_LEAD_MAIL_FROM_EMAIL, $from_email && is_email($from_email) ? $from_email : '');
        add_settings_error('jauction_lead_mail', 'saved', '설정을 저장했습니다.', 'updated');
    } elseif ($action === 'rotate') {
        check_admin_referer('jauction_lead_mail_rotate');
        update_option(JAUCTION_LEAD_MAIL_TOKEN, wp_generate_password(40, false, false));
        add_settings_error('jauction_lead_mail', 'rotated', '토큰을 재발급했습니다. Worker secret도 새 토큰으로 다시 설정해야 합니다.', 'updated');
    } elseif ($action === 'test') {
        check_admin_referer('jauction_lead_mail_test');
        $result = jauction_lead_mail_send([
            'event' => 'lead.created',
            'id' => 'wp-test',
            'created_at' => current_time('mysql'),
            'name' => '알림 점검',
            'phone' => '0000000000',
            'email' => 'codex-share-mail-bridge@example.com',
            'type' => '테스트',
            'case_or_address' => 'WordPress 관리자 테스트',
            'share' => '-',
            'owners' => '-',
            'status' => '테스트',
            'message' => 'WP Mail SMTP 발송 경로가 정상인지 확인하는 테스트입니다.',
            'source' => admin_url('options-general.php?page=jauction-lead-mail'),
        ]);
        if ($result['ok']) {
            add_settings_error('jauction_lead_mail', 'test_sent', '테스트 메일을 보냈습니다.', 'updated');
        } else {
            add_settings_error('jauction_lead_mail', 'test_failed', '테스트 메일 발송 실패: ' . esc_html($result['error']), 'error');
        }
    }
}
