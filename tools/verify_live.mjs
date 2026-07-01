const siteBase = process.env.JAUCTION_SITE_BASE || "https://jiggyj744-ctrl.github.io";
const workerBase = "https://jauction-lead-api.jiggyj.workers.dev";
const legacyFactory = String.fromCharCode(70, 97, 99, 116, 111, 114, 121, 80, 114, 111);
const legacyPattern = new RegExp(`${legacyFactory}|Astra|google-site-verification`, "i");

const publicPaths = [
  "/",
  "/faq/",
  "/privacy/",
  "/services/share-purchase/",
  "/services/share-auction/",
  "/services/inherited-share/",
  "/services/land-share/",
  "/services/co-ownership-dispute/",
  "/services/commercial-share/",
  "/sitemap.xml",
  "/robots.txt",
  "/404.html",
];

const errors = [];

for (const path of publicPaths) {
  const url = `${siteBase}${path}${path.includes("?") ? "&" : "?"}live_check=${Date.now()}`;
  const response = await fetch(url);
  const text = await response.text();
  if (response.status !== 200) errors.push(`${path} status ${response.status}`);
  if (legacyPattern.test(text)) errors.push(`${path} contains legacy text`);
}

const home = await fetchText(`${siteBase}/?live_check=${Date.now()}`);
mustContain(home, "jauction-lead-api.jiggyj.workers.dev/lead", "home lead endpoint");
mustContain(home, "공유물 지분", "home core text");
mustContain(home, "상담신청 메일 보내기", "mail submit button");
mustContain(home, "개인정보 수집·이용에 동의합니다", "privacy consent text");
mustContain(home, "/assets/styles.css?v=20260701-7", "home stylesheet version");
mustContain(home, "/assets/main.js?v=20260701-7", "home script version");
if (/문자로 보내기|전화하기|내용 복사|sms:|navigator\.clipboard/.test(home)) {
  errors.push("public home contains removed fallback actions");
}

const js = await fetchText(`${siteBase}/assets/main.js?v=20260701-7&live_check=${Date.now()}`);
mustContain(js, "feedback-modal", "feedback modal");
mustContain(js, "접수가 완료되었습니다", "mail success text");
mustContain(js, "전송 실패", "mail failure text");
mustContain(js, "메일 발송이 완료되지 않았습니다", "mail delivery failure detail text");
mustContain(js, "서버 응답이 지연되어", "mail timeout failure text");
if (/문자로 보내기|전화하기|내용 복사|sms:|navigator\.clipboard/.test(js)) {
  errors.push("public script contains removed fallback actions");
}

const health = await fetchJson(`${workerBase}/health`);
if (!health.ok || health.service !== "jauction-lead-api") {
  errors.push("worker health failed");
}

const admin = await fetchText(`${workerBase}/admin`);
mustContain(admin, "Jauction 리드 관리자", "admin title");

const blocked = await fetch(`${workerBase}/admin/leads`);
if (blocked.status !== 401) {
  errors.push(`unauthorized admin status ${blocked.status}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`live verification passed: ${publicPaths.length} public pages, worker health, admin guard`);

async function fetchText(url) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) errors.push(`${url} status ${response.status}`);
  return text;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) errors.push(`${url} status ${response.status}`);
  try {
    return JSON.parse(text);
  } catch {
    errors.push(`${url} invalid json`);
    return {};
  }
}

function mustContain(text, needle, label) {
  if (!text.includes(needle)) errors.push(`${label} missing`);
}
