const siteBase = process.env.JAUCTION_SITE_BASE || "https://jiggyj744-ctrl.github.io";
const workerBase = "https://jauction-lead-api.jiggyj.workers.dev";
const legacyFactory = String.fromCharCode(70, 97, 99, 116, 111, 114, 121, 80, 114, 111);
const legacyPattern = new RegExp(`${legacyFactory}|Astra|google-site-verification`, "i");
const phrase = (...parts) => parts.join("");
const publicStrategyPattern = new RegExp([
  "매입전략",
  "매입 전략",
  phrase("최저", " 입찰가"),
  phrase("입찰", " 일정"),
  "현물 분할",
  "경매 분할",
  "단독 소유",
  "공유물분할 전략",
  "가치 하락",
  "최선의 방안",
  "최적의 해결",
  "종합적으로 분석",
  "경매 절차 내",
  phrase("분할", " 방법"),
  "예상 비용",
  "소요 기간",
  "권리 행사",
  "경매에 참여",
  "매입 가능성이 높",
  "리스크를 최소화",
  "정리 전략",
  "회수 전략",
  "청산 가능성과 비용",
  "낙찰 후 정리",
  "정리 비용",
  "회수 기간",
  "정리 가능성",
  "우선매수권 행사 가능성",
  "과도한 입찰가",
  "회수 지연",
  "일정과 전략",
  "공유물분할 가능성",
  "공유물분할 소송 등을 통해 현금화",
  "법적 절차를 통한 현금화",
  "변호사 선임 없이",
  "예상 기간",
  "적정 가격을 산정",
  "가격에 영향을 줄 수 있습니다",
  "오히려 매입이 용이",
  "일반 매입 절차",
  "모든 법적 절차",
  "개별 협의",
  "공동매각 가능성",
  "현실적인 정리 방향",
  "협의 비용",
  "낙찰가보다",
  "사용수익 구조",
  "수익 배분",
  "분할, 공동매각",
  "매입 가격",
  "인도 시기",
  "잔금 조건",
  phrase("소유권", " 이전"),
  "매입 가치",
  "절차를 안내",
  "일정 기간",
  "매수 의사",
  "통지해야",
  "우선매수권 절차",
  "매입 절차",
  "현금화",
  "배당",
  "명도",
  "매도 시나리오",
  "지분 가치",
  "법적으로 보호되는 권리",
  "매입 후에도 분쟁",
  "입찰 검토자",
  "보증금",
  "<span>전화</span>",
].join("|"));

const publicPaths = [
  "/",
  "/blog/",
  "/blog/auction-case-number-share-review/",
  "/blog/inherited-share-sale-records/",
  "/faq/",
  "/privacy/",
  "/areas/seoul-share-purchase/",
  "/areas/gyeonggi-share-purchase/",
  "/areas/incheon-share-purchase/",
  "/areas/busan-share-purchase/",
  "/guide/auction-case-number-review/",
  "/guide/commercial-share-acquisition/",
  "/guide/inherited-share-sale/",
  "/guide/land-share-acquisition/",
  "/guide/partition-claim-share-sale/",
  "/guide/preemption-right/",
  "/guide/sell-co-owned-share/",
  "/guide/unreachable-co-owner-share/",
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
  if (publicStrategyPattern.test(text)) errors.push(`${path} contains public strategy text`);
  if (!path.endsWith(".xml") && !path.endsWith(".txt")) {
    if (/<h[23]>\s*<\/h[23]>/.test(text)) errors.push(`${path} contains empty heading`);
    if (/<summary>\s*<\/summary>/.test(text)) errors.push(`${path} contains empty faq summary`);
    if (/<p>\s*<\/p>/.test(text)) errors.push(`${path} contains empty paragraph`);
  }
}

const home = await fetchText(`${siteBase}/?live_check=${Date.now()}`);
mustContain(home, "jauction-lead-api.jiggyj.workers.dev/lead", "home lead endpoint");
mustContain(home, "공유물 지분", "home core text");
mustContain(home, "상담신청 메일 보내기", "mail submit button");
mustContain(home, "개인정보 수집·이용에 동의합니다", "privacy consent text");
mustContain(home, "/assets/styles.css?v=20260702-1", "home stylesheet version");
mustContain(home, "/assets/main.js?v=20260702-1", "home script version");
if (/문자로 보내기|전화하기|내용 복사|sms:|navigator\.clipboard|<span>전화<\/span>/.test(home)) {
  errors.push("public home contains removed fallback actions");
}

const js = await fetchText(`${siteBase}/assets/main.js?v=20260702-1&live_check=${Date.now()}`);
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
