# Jauction Lead Mail Bridge

Cloudflare Pages/GitHub Pages 랜딩의 상담 접수를 WordPress `wp_mail()`로 전달하는 브리지 플러그인입니다. WP Mail SMTP가 WordPress에 설정되어 있으면 상담 메일도 같은 SMTP 경로로 발송됩니다.

## 역할

- 보호된 REST 주소 `/wp-json/jauction/v1/lead` 제공
- Cloudflare Worker에서 전달한 상담 내용을 `wp_mail()`로 발송
- 수신 이메일, 발신자 이름, 발신자 이메일, 브리지 토큰 관리
- 상담자 이메일 본문 표시 및 Reply-To 헤더 적용
- 이전 사이트 도메인 발신주소가 남아 있으면 지분매입 기본 발신자로 보정
- 마지막 발송 상태만 저장

상담 원본 저장 기준은 Cloudflare D1입니다. 이 플러그인은 WordPress에 상담 내용을 목록으로 저장하지 않습니다.

## 설치 후 설정

1. WordPress 관리자에서 플러그인 ZIP을 업로드하고 활성화합니다.
2. `설정 > Jauction Mail`로 이동합니다.
3. 수신 이메일과 발신자 이메일을 확인하고 `테스트 메일 보내기`를 실행합니다.
4. 화면의 REST Endpoint와 Worker Secret Token을 Cloudflare Worker에 설정합니다.

기본 발신자 이름은 `지분매입 상담센터`입니다. 기존 설정에 이전 사이트 도메인 주소가 남아 있으면 `jiggyj@naver.com`으로 보정합니다.

발신자 이메일은 인증 가능한 메일 도메인의 주소를 사용하는 것이 가장 안전합니다. 무료 `github.io` 주소는 메일 발신 도메인으로 인증할 수 없습니다. 전용 도메인을 연결한 뒤에는 `no-reply@전용도메인`처럼 SPF/DKIM이 맞는 주소로 바꾸는 것을 권장합니다. WP Mail SMTP의 `Force From Email`이 켜져 있으면 WP Mail SMTP 설정값이 우선될 수 있습니다.

```powershell
cmd /c npx --yes wrangler secret put WORDPRESS_WEBHOOK_TOKEN
cmd /c npx --yes wrangler deploy
```

`WORDPRESS_WEBHOOK_URL`은 Worker `wrangler.jsonc`의 vars 또는 Cloudflare 대시보드 변수로 설정합니다.

```text
https://워드프레스도메인/wp-json/jauction/v1/lead
```

## 확인

```powershell
node workers/lead-api/scripts/leads.mjs notify-config
node workers/lead-api/scripts/leads.mjs notify-test
```

정상 구성 시 `effective_email_channel`은 `wordpress_wp_mail`로 표시됩니다.

수신 메일에서 확인할 항목:

- 보낸사람: `지분매입 상담센터 <설정한 발신자 이메일>`
- 제목: `[지분매입 상담신청][SHARE-CONSULTATION] ...`
- 본문: 내부 식별값 `SHARE-CONSULTATION-CUSTOMER-FORM`
- 본문: 이름, 연락처, 이메일, 상담유형, 주소/사건번호, 지분율, 공유자 수, 현재 상태, 출처, 상담 내용
