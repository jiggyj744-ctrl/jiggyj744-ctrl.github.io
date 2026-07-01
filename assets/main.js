window.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

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

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const result = form.querySelector(".form-result");
      const data = Object.fromEntries(new FormData(form).entries());
      if (data.company_website) return;
      const invalid = firstInvalidField(form, data);
      if (invalid) {
        showResult(result, clientValidationMessage(invalid), "error");
        invalid.focus();
        return;
      }
      const last = Number(localStorage.getItem("jauction_last_submit") || "0");
      const now = Date.now();
      if (now - last < 60000) {
        showResult(result, "연속 메일 접수는 1분 뒤 다시 시도해 주세요.", "error");
        return;
      }
      const endpoint = form.dataset.endpoint || window.JAUCTION_LEAD_ENDPOINT || "";
      const submitButton = form.querySelector('button[type="submit"]');
      const originalButtonText = submitButton ? submitButton.textContent : "";
      setSubmitting(submitButton, true, "메일 전송 중");
      showResult(result, "상담신청 메일을 전송하고 있습니다.", "pending", false);
      if (endpoint) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ ...data, submitted_at: new Date().toISOString(), source: location.href }),
          });
          const payload = await response.json().catch(() => ({}));
          if (response.ok) {
            if (payload.notification_status !== "sent") {
              showResult(result, mailFailureMessage(payload), "error");
              return;
            }
            const suffix = payload.id ? " 접수번호: " + payload.id : "";
            localStorage.setItem("jauction_last_submit", String(Date.now()));
            showResult(result, "상담신청 메일이 전송되었습니다. 담당자가 확인 후 연락드리겠습니다." + suffix, "success");
            form.reset();
            if (submittedAt) {
              submittedAt.value = new Date().toISOString();
            }
            return;
          }
          showResult(result, serverErrorMessage(payload.error), "error");
          return;
        } catch (error) {
          showResult(result, "서버 연결 문제로 상담신청 메일을 보내지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.", "error");
          return;
        } finally {
          setSubmitting(submitButton, false, originalButtonText);
        }
      } else {
        setSubmitting(submitButton, false, originalButtonText);
      }
      showResult(
        result,
        "메일 전송에 실패했습니다. 입력 내용은 접수되지 않았습니다. 잠시 후 다시 시도해 주세요.",
        "error",
      );
    });
  });
});

function clientValidationMessage(input) {
  if (!input) return "필수 항목을 확인해 주세요.";
  if (input.name === "name") return "이름을 입력해 주세요.";
  if (input.name === "phone") return "연락처는 숫자, +, -, 공백, 괄호만 입력해 주세요. 예: 01012345678";
  if (input.name === "email") return "이메일 형식을 확인해 주세요. 예: name@example.com";
  if (input.name === "type") return "상담 유형을 선택해 주세요.";
  if (input.name === "case_or_address") return "주소 또는 사건번호를 입력해 주세요.";
  if (input.name === "privacy_agree") return "개인정보 수집·이용 동의가 필요합니다.";
  return "필수 항목을 확인해 주세요.";
}

function firstInvalidField(form, data) {
  const phonePattern = /^[0-9+-\s().]{8,30}$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!String(data.name || "").trim()) return form.elements.name;
  if (!phonePattern.test(String(data.phone || "").trim())) return form.elements.phone;
  if (data.email && !emailPattern.test(String(data.email || "").trim())) return form.elements.email;
  if (!String(data.type || "").trim()) return form.elements.type;
  if (!String(data.case_or_address || "").trim()) return form.elements.case_or_address;
  if (!data.privacy_agree) return form.elements.privacy_agree;
  return null;
}

function serverErrorMessage(error) {
  return {
    phone_invalid: "연락처는 숫자, +, -, 공백, 괄호만 입력해 주세요. 예: 01012345678",
    email_invalid: "이메일 형식을 확인해 주세요. 예: name@example.com",
    privacy_required: "개인정보 수집·이용 동의가 필요합니다.",
    rate_limited: "접수 요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.",
    case_or_address_required: "주소 또는 사건번호를 입력해 주세요.",
    name_required: "이름을 입력해 주세요.",
    type_required: "상담 유형을 선택해 주세요.",
  }[error] || "메일 전송에 실패했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.";
}

function mailFailureMessage(payload) {
  const receipt = payload.id ? " 접수번호: " + payload.id + "." : "";
  const status = notificationStatusLabel(payload.notification_status);
  const channel = payload.notification_channel ? " 발송 경로: " + payload.notification_channel + "." : "";
  const reason = payload.notification_error ? " 사유: " + payload.notification_error + "." : "";
  return "상담 내용은 저장됐지만 메일 발송이 완료되지 않았습니다." + receipt + " 상태: " + status + "." + channel + reason + " 관리자 화면에서 접수 내용을 확인해야 합니다.";
}

function notificationStatusLabel(status) {
  return {
    not_configured: "메일 발송 설정 없음",
    failed: "메일 발송 실패",
    partial_failed: "일부 메일 발송 실패",
    unknown: "메일 상태 확인 불가",
  }[status] || "메일 상태 확인 불가";
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

function setSubmitting(button, submitting, label) {
  if (!button) return;
  button.disabled = submitting;
  button.setAttribute("aria-busy", submitting ? "true" : "false");
  if (!submitting && label) {
    button.innerHTML = '<i data-lucide="send"></i><span>' + label + '</span>';
  } else if (submitting) {
    button.innerHTML = '<i data-lucide="loader-circle"></i><span>' + label + '</span>';
  }
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
