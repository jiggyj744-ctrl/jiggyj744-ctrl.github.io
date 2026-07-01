window.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  const submitThrottleMs = 60_000;
  const submitTimeoutMs = 20_000;

  document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const href = anchor.getAttribute("href");
      const hash = href && href.includes("#") ? href.slice(href.indexOf("#")) : href;
      if (!hash || hash === "#") return;
      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-lead-form]").forEach((form) => {
    const submittedAt = form.querySelector('input[name="submitted_at"]');
    if (submittedAt) {
      submittedAt.value = new Date().toISOString();
    }

    const result = ensureFormResult(form);
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? (submitButton.textContent || "").trim() : "상담신청";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const data = Object.fromEntries(new FormData(form).entries());
      if (data.company_website) {
        return;
      }

      const invalid = firstInvalidField(form, data);
      if (invalid) {
        const message = clientValidationMessage(invalid);
        showResult(result, message, "error");
        showFeedbackModal("입력 확인", message, "error");
        invalid.focus();
        return;
      }

      const last = readLastSubmit();
      const now = Date.now();
      if (now - last < submitThrottleMs) {
        const message = "연속 메일 접수는 1분 뒤 다시 시도해 주세요.";
        showResult(result, message, "error");
        showFeedbackModal("접수 제한", message, "error");
        return;
      }

      const endpoint = form.dataset.endpoint || window.JAUCTION_LEAD_ENDPOINT || "";
      if (!endpoint) {
        const message = "상담 신청 전송 경로가 준비되지 않았습니다. 관리자에게 문의해 주세요.";
        showResult(result, message, "error");
        showFeedbackModal("전송 실패", message, "error");
        setSubmitting(submitButton, false, originalButtonText);
        return;
      }

      setSubmitting(submitButton, true, "메일 전송 중");
      showResult(result, "상담신청 메일을 전송하고 있습니다.", "pending", false);

      try {
        const response = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ ...data, submitted_at: new Date().toISOString(), source: location.href }),
        }, submitTimeoutMs);
        const rawText = await response.text();
        const payload = parsePayload(rawText);

        if (response.ok) {
          if (payload.notification_status === "sent") {
            const suffix = payload.id ? " 접수번호: " + payload.id : "";
            writeLastSubmit(Date.now());
            const message = "접수가 완료되었습니다. 담당자가 검토 후 연락드리겠습니다." + suffix;
            showResult(result, message, "success");
            showFeedbackModal("상담 접수 완료", message, "success");
            form.reset();
            if (submittedAt) {
              submittedAt.value = new Date().toISOString();
            }
            return;
          }

          const message = mailFailureMessage(payload);
          showResult(result, message, "error");
          showFeedbackModal("메일 발송 실패", message, "error");
          return;
        }

        const message = serverErrorMessage(payload.error, response.status, response.statusText);
        showResult(result, message, "error");
        showFeedbackModal("전송 실패", message, "error");
      } catch (error) {
        const message = requestErrorMessage(error);
        showResult(result, message, "error");
        showFeedbackModal("전송 실패", message, "error");
      } finally {
        setSubmitting(submitButton, false, originalButtonText);
      }
    });
  });
});

function ensureFormResult(form) {
  let result = form.querySelector(".form-result");
  if (result) return result;
  result = document.createElement("div");
  result.className = "form-result";
  result.setAttribute("role", "status");
  result.setAttribute("aria-live", "polite");
  result.setAttribute("tabindex", "-1");
  result.hidden = true;
  form.appendChild(result);
  return result;
}

function parsePayload(rawText) {
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return {
      error: "invalid_response",
      response_text: String(rawText).slice(0, 200),
    };
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function requestErrorMessage(error) {
  if (error && error.name === "AbortError") {
    return "서버 응답이 지연되어 상담신청 메일 전송을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  const rawError = error instanceof Error ? error.message : String(error || "");
  return `네트워크 오류로 상담신청 메일 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.${rawError ? " " + rawError : ""}`;
}

function readLastSubmit() {
  try {
    return Number(window.localStorage.getItem("jauction_last_submit") || "0");
  } catch {
    return 0;
  }
}

function writeLastSubmit(value) {
  try {
    window.localStorage.setItem("jauction_last_submit", String(value));
  } catch {
    // Some privacy modes block localStorage. Submission has already succeeded.
  }
}

function clientValidationMessage(input) {
  if (!input) return "입력값을 다시 확인해 주세요.";
  if (input.name === "name") return "이름을 입력해 주세요.";
  if (input.name === "phone") return "연락처는 숫자, +, -, 공백, 괄호만 입력해 주세요. 예: 01012345678";
  if (input.name === "email") return "이메일 형식을 확인해 주세요. 예: name@example.com";
  if (input.name === "type") return "상담 유형을 선택해 주세요.";
  if (input.name === "case_or_address") return "주소 또는 사건번호를 입력해 주세요.";
  if (input.name === "privacy_agree") return "개인정보 수집·이용 동의를 체크해 주세요.";
  return "입력값을 확인해 주세요.";
}

function firstInvalidField(form, data) {
  const phonePattern = /^[0-9+\-\s().]{8,30}$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!String(data.name || "").trim()) return form.elements.name;
  if (!phonePattern.test(String(data.phone || "").trim())) return form.elements.phone;
  if (data.email && !emailPattern.test(String(data.email || "").trim())) return form.elements.email;
  if (!String(data.type || "").trim()) return form.elements.type;
  if (!String(data.case_or_address || "").trim()) return form.elements.case_or_address;
  if (!data.privacy_agree) return form.elements.privacy_agree;
  return null;
}

function serverErrorMessage(error, status, statusText) {
  const details = status ? ` (HTTP ${status} ${statusText || ""})` : "";
  const map = {
    phone_invalid: "연락처는 숫자, +, -, 공백, 괄호만 입력해 주세요. 예: 01012345678",
    email_invalid: "이메일 형식을 확인해 주세요. 예: name@example.com",
    privacy_required: "개인정보 수집·이용 동의가 필요합니다.",
    rate_limited: "상담 접수는 1분 뒤에 다시 시도해 주세요.",
    case_or_address_required: "주소 또는 사건번호를 입력해 주세요.",
    name_required: "이름을 입력해 주세요.",
    type_required: "상담 유형을 선택해 주세요.",
    origin_not_allowed: "요청 출처가 허용되지 않습니다. 도메인 설정을 확인해 주세요.",
    invalid_json: "응답 형식이 올바르지 않아 접수 결과를 읽을 수 없습니다.",
    payload_too_large: "입력 정보가 너무 커서 접수를 완료할 수 없습니다.",
    invalid_response: "서버 응답 형식이 유효하지 않습니다.",
  }[error] || "상담신청 전송에 실패했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.";
  return `${map}${details}`;
}

function mailFailureMessage(payload) {
  const receipt = payload && payload.id ? " 접수번호: " + payload.id + "." : "";
  const status = notificationStatusLabel(payload && payload.notification_status);
  const channel = payload && payload.notification_channel ? ` 메일 발송 경로: ${payload.notification_channel}.` : "";
  const reason = payload && payload.notification_error ? ` 사유: ${payload.notification_error}.` : "";
  return (
    "상담 접수는 저장되었지만 메일 발송이 완료되지 않았습니다." +
    receipt +
    ` 상태: ${status}.` +
    channel +
    reason +
    " 관리자 화면에서 접수 내용을 확인해 주세요."
  );
}

function notificationStatusLabel(status) {
  return {
    not_configured: "메일 발송 미설정",
    failed: "메일 발송 실패",
    partial_failed: "일부 메일 발송 실패",
    unknown: "메일 상태 미확인",
  }[status] || "메일 상태 미확인";
}

function showResult(target, message, state = "info", shouldFocus = true) {
  if (!target) return;
  target.hidden = false;
  target.dataset.state = state;
  target.innerHTML = "";
  const p = document.createElement("p");
  p.textContent = message;
  target.appendChild(p);
  if (shouldFocus) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }
}

function showFeedbackModal(title, message, state = "info") {
  const modal = feedbackModal();
  modal.root.hidden = false;
  modal.root.dataset.state = state;
  modal.icon.textContent = state === "success" ? "✓" : "!";
  modal.title.textContent = title;
  modal.message.textContent = message;
  requestAnimationFrame(() => {
    modal.panel.focus({ preventScroll: true });
  });
}

function hideFeedbackModal() {
  const modal = document.querySelector("[data-feedback-modal]");
  if (!modal) return;
  modal.hidden = true;
}

function feedbackModal() {
  let root = document.querySelector("[data-feedback-modal]");
  if (!root) {
    root = document.createElement("div");
    root.className = "feedback-modal";
    root.dataset.feedbackModal = "";
    root.hidden = true;
    root.innerHTML = [
      '<div class="feedback-modal-panel" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title" tabindex="-1">',
      '<button class="feedback-modal-close" type="button" aria-label="닫기">×</button>',
      '<div class="feedback-modal-icon" aria-hidden="true">!</div>',
      '<h2 id="feedback-modal-title"></h2>',
      '<p data-feedback-modal-message></p>',
      '<div class="feedback-modal-actions"><button class="btn btn-primary" type="button" data-feedback-modal-confirm>확인</button></div>',
      "</div>",
    ].join("");
    root.addEventListener("click", (event) => {
      if (event.target === root || event.target.closest("[data-feedback-modal-confirm]") || event.target.closest(".feedback-modal-close")) {
        hideFeedbackModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideFeedbackModal();
    });
    document.body.appendChild(root);
  }
  return {
    root,
    panel: root.querySelector(".feedback-modal-panel"),
    icon: root.querySelector(".feedback-modal-icon"),
    title: root.querySelector("#feedback-modal-title"),
    message: root.querySelector("[data-feedback-modal-message]"),
  };
}

function setSubmitting(button, submitting, label) {
  if (!button) return;
  button.disabled = submitting;
  button.setAttribute("aria-busy", submitting ? "true" : "false");
  if (!submitting && label) {
    button.innerHTML = '<i data-lucide="send"></i><span>' + label + "</span>";
  } else if (submitting) {
    button.innerHTML = '<i data-lucide="loader-circle"></i><span>' + label + "</span>";
  }
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
