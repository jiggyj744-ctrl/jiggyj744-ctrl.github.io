import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(__dirname, "..");
const root = fs.existsSync(path.join(workspace, "public", "index.html")) && !fs.existsSync(path.join(workspace, "index.html"))
  ? path.join(workspace, "public")
  : workspace;
const verification = readVerification();

const requiredFiles = [
  "index.html",
  "404.html",
  "faq/index.html",
  "privacy/index.html",
  "blog/index.html",
  "services/share-purchase/index.html",
  "services/share-auction/index.html",
  "services/inherited-share/index.html",
  "services/land-share/index.html",
  "services/co-ownership-dispute/index.html",
  "services/commercial-share/index.html",
  "assets/styles.css",
  "assets/main.js",
  "assets/hero-consultation.png",
  "favicon.svg",
  "robots.txt",
  "sitemap.xml",
  "feed.xml",
  ".nojekyll",
];

const banned = [
  legacyFactoryToken(),
  legacyFactoryToken().toLowerCase(),
  "Astra",
  "REPLACE_ME",
  "\uFFFD",
];

const strategyBanned = [
  ["매입", "전략"].join(""),
  ["최저", "입찰가"].join(""),
  ["입찰", "일정"].join(""),
  ["현물", "분할"].join(""),
  ["경매", "분할"].join(""),
  ["단독", "소유"].join(""),
  ["공유물분할", "전략"].join(""),
  ["가치", "하락"].join(""),
  ["최선의", "방안"].join(""),
  ["최적의", "해결"].join(""),
  ["종합적으로", "분석"].join(""),
  ["경매 절차", "내"].join(""),
  ["분할", "방법"].join(""),
  ["예상", "비용"].join(""),
  ["소요", "기간"].join(""),
  ["권리", "행사"].join(""),
  ["경매에", "참여"].join(""),
  ["매입 가능성이", "높"].join(""),
  ["리스크를", "최소화"].join(""),
  ["정리", "전략"].join(""),
  ["회수", "전략"].join(""),
  ["청산 가능성과", "비용"].join(""),
  ["낙찰 후", "정리"].join(""),
  ["정리", "비용"].join(""),
  ["회수", "기간"].join(""),
  ["정리", "가능성"].join(""),
  ["우선매수권 행사", "가능성"].join(""),
  ["과도한", "입찰가"].join(""),
  ["회수", "지연"].join(""),
  ["일정과", "전략"].join(""),
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
  "소유권 이전",
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
  ["<span>", "전화", "</span>"].join(""),
];

const requiredText = {
  "index.html": [
    "privacy_agree",
    "company_website",
    "상담신청 메일 보내기",
    "https://jauction-lead-api.jiggyj.workers.dev/lead",
    "FAQPage",
    "ProfessionalService",
  ],
  "assets/main.js": ["localStorage", "jauction_last_submit", "feedback-modal", "상담 접수 완료", "접수가 완료되었습니다", "메일 발송이 완료되지 않았습니다", "서버 응답이 지연되어", "연락처는 숫자", "접수번호"],
  "robots.txt": ["Sitemap: https://jiggyj744-ctrl.github.io/sitemap.xml"],
  "sitemap.xml": [
    "https://jiggyj744-ctrl.github.io/",
    "https://jiggyj744-ctrl.github.io/services/share-purchase/",
    "https://jiggyj744-ctrl.github.io/services/share-auction/",
    "https://jiggyj744-ctrl.github.io/blog/",
    "2026-07-01",
  ],
  "blog/index.html": ["지분매입 블로그", "CollectionPage", "feed.xml", "1688-0976"],
  "feed.xml": ["<rss", "<channel>", "Jauction 지분매입 블로그"],
};

const errors = [];
const verificationFileNames = new Set([verification.googleFile?.name, verification.naverFile?.name].filter(Boolean));

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    errors.push(`missing required file: ${file}`);
  }
}

for (const [file, needles] of Object.entries(requiredText)) {
  if (!fs.existsSync(path.join(root, file))) continue;
  const content = read(file);
  for (const needle of needles) {
    if (!content.includes(needle)) {
      errors.push(`${file} missing text: ${needle}`);
    }
  }
}

const textFiles = [];
walk(root);

for (const file of textFiles) {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  const base = path.basename(file);
  const isVerificationFile = verificationFileNames.has(base);
  const content = fs.readFileSync(file, "utf8");
  if (isVerificationFile) {
    continue;
  }
  for (const needle of banned) {
    if (content.includes(needle)) {
      errors.push(`${rel} contains banned text: ${needle}`);
    }
  }
  const shouldCheckStrategyText =
    rel.endsWith(".html") ||
    rel.endsWith(".xml") ||
    rel === "tools/build_site.mjs" ||
    rel === "scripts/seo-content-engine.mjs";
  if (shouldCheckStrategyText) {
    for (const needle of strategyBanned) {
      if (content.includes(needle)) {
        errors.push(`${rel} contains public strategy text: ${needle}`);
      }
    }
  }
  if (!verification.googleMeta && content.includes("google-site-verification")) {
    errors.push(`${rel} contains unmanaged google verification text`);
  }
  if (!verification.naverMeta && content.includes("naver-site-verification")) {
    errors.push(`${rel} contains unmanaged naver verification text`);
  }
}

const htmlFiles = textFiles.filter((file) => file.endsWith(".html") && !verificationFileNames.has(path.basename(file)));
for (const file of htmlFiles) {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes('<html lang="ko">')) errors.push(`${rel} missing lang=ko`);
  if (!content.includes('<meta name="description"')) errors.push(`${rel} missing description`);
  if (!content.includes('<link rel="canonical"')) errors.push(`${rel} missing canonical`);
  if (!content.includes('<link rel="icon"')) errors.push(`${rel} missing favicon`);
  if (!content.includes("/assets/styles.css?v=20260701-7")) errors.push(`${rel} missing stylesheet`);
  if (!content.includes("/assets/main.js?v=20260701-7")) errors.push(`${rel} missing script`);
  if (/<h[23]>\s*<\/h[23]>/.test(content)) errors.push(`${rel} contains empty heading`);
  if (/<summary>\s*<\/summary>/.test(content)) errors.push(`${rel} contains empty faq summary`);
  if (/<p>\s*<\/p>/.test(content)) errors.push(`${rel} contains empty paragraph`);
}

if (verification.googleFile?.name) {
  assertVerificationFile(verification.googleFile);
}
if (verification.naverFile?.name) {
  assertVerificationFile(verification.naverFile);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`verification passed: ${requiredFiles.length} required files, ${htmlFiles.length} html files`);

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".wrangler" || entry.name === "tools") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (/\.(html|css|js|xml|txt|md|mjs|json)$/i.test(entry.name)) {
      textFiles.push(full);
    }
  }
}

function readVerification() {
  const file = path.join(workspace, "tools", "search-verification.json");
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function legacyFactoryToken() {
  return String.fromCharCode(70, 97, 99, 116, 111, 114, 121, 80, 114, 111);
}

function assertVerificationFile(record) {
  const safeName = path.basename(record.name);
  if (safeName !== record.name || !/^[a-z0-9._-]+\.html$/i.test(safeName)) {
    errors.push(`invalid verification file name: ${record.name}`);
    return;
  }
  const target = path.join(root, safeName);
  if (!fs.existsSync(target)) {
    errors.push(`missing verification file: ${safeName}`);
    return;
  }
  if (record.content && fs.readFileSync(target, "utf8").trim() !== String(record.content).trim()) {
    errors.push(`verification file content mismatch: ${safeName}`);
  }
}
