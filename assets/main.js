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
      if (!form.reportValidity()) return;
      const last = Number(localStorage.getItem("jauction_last_submit") || "0");
      const now = Date.now();
      if (now - last < 60000) {
        showResult(result, "연속 메일 접수는 1분 뒤 다시 시도해 주세요.");
        return;
      }
      const endpoint = form.dataset.endpoint || window.JAUCTION_LEAD_ENDPOINT || "";
      const submitButton = form.querySelector('button[type="submit"]');
      const originalButtonText = submitButton ? submitButton.textContent : "";
      setSubmitting(submitButton, true, "메일 전송 중");
      showResult(result, "상담신청 메일을 전송하고 있습니다.");
      if (endpoint) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, submitted_at: new Date().toISOString(), source: location.href }),
          });
          if (response.ok) {
            const payload = await response.json().catch(() => ({}));
            if (payload.notification_status && payload.notification_status !== "sent") {
              showResult(result, "접수는 저장되었지만 메일 발송 확인이 필요합니다. 잠시 후 다시 시도해 주세요.");
              return;
            }
            const suffix = payload.id ? " 접수번호: " + payload.id : "";
            localStorage.setItem("jauction_last_submit", String(Date.now()));
            showResult(result, "상담신청 메일이 전송되었습니다. 담당자가 확인 후 연락드리겠습니다." + suffix);
            form.reset();
            if (submittedAt) {
              submittedAt.value = new Date().toISOString();
            }
            return;
          }
        } catch (error) {
          // Show a clear failure state below.
        } finally {
          setSubmitting(submitButton, false, originalButtonText);
        }
      } else {
        setSubmitting(submitButton, false, originalButtonText);
      }
      showResult(
        result,
        "메일 전송에 실패했습니다. 입력 내용은 접수되지 않았습니다. 잠시 후 다시 시도해 주세요.",
      );
    });
  });
});

function showResult(target, message) {
  if (!target) return;
  target.hidden = false;
  target.innerHTML = "";
  const p = document.createElement("p");
  p.textContent = message;
  target.appendChild(p);
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
