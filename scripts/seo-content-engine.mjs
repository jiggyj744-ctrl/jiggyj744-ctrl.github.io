import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const siteBase = (process.env.SITE_BASE || "https://jiggyj744-ctrl.github.io").replace(/\/$/, "");
const model = process.env.OPENAI_MODEL || "gpt-5.5";
const generationMode = process.env.GENERATION_MODE || "template";
const allowDirectOpenAI = process.env.ALLOW_DIRECT_OPENAI === "1";
const today = new Date().toISOString().slice(0, 10);
const args = process.argv.slice(2);
const limit = Math.max(1, Math.min(5, Number.parseInt(args[args.indexOf("--limit") + 1] || "1", 10) || 1));
const legacyFactory = String.fromCharCode(70,97,99,116,111,114,121,80,114,111);
const legacyAuction = ["공장", "경매"].join("");
const legacyKey = ["Key", "zard"].join("");
const legacyPhone = "010" + "68991601";
const legacyPhoneDashed = ["010", "6899", "1601"].join("-");
const banned = [legacyFactory, legacyFactory.toLowerCase(), legacyAuction, legacyKey, legacyKey.toLowerCase(), legacyPhone, legacyPhoneDashed];
const facts = readJson("content/business-facts.json");
const backlog = readJson("content/keyword-backlog.json");
const prompt = fs.existsSync("prompts/share-index-page.md") ? fs.readFileSync("prompts/share-index-page.md", "utf8") : "";
const selected = backlog.keywords.filter((item) => ["queued", "improve"].includes(item.status)).slice(0, limit);
const published = [];

for (const item of selected) {
  const generated = await generateContent(item);
  const page = normalizePage(item, generated);
  const html = renderPage(page);
  qaPage(page, html);
  const targetDir = path.join(root, page.slug);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "index.html"), html, "utf8");
  item.status = "published";
  item.lastPublished = today;
  item.url = siteBase + "/" + page.slug + "/";
  published.push(page);
}

if (published.length) { updateSitemap(published); updateIndexLinks(backlog.keywords.filter((item) => item.status === "published")); writeJson("content/keyword-backlog.json", backlog); updateOps(published); }
console.log("continuous indexing published " + published.length + " page(s)");

async function generateContent(item) {
  if (generationMode === "template") return fallbackContent(item, "template-cost-safe");
  if (process.env.LLM_PROXY_BASE_URL) return generateViaProxy(item);
  if (!allowDirectOpenAI || !process.env.OPENAI_API_KEY) return fallbackContent(item, "template-direct-disabled");
  const input = [prompt, "Business facts JSON:", JSON.stringify(facts), "Keyword request JSON:", JSON.stringify(item), "Return strict JSON with keys title, description, h1, eyebrow, lead, sections, faqs."].join("\n");
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ model, input, text: { format: { type: "json_object" } } }) });
    if (!response.ok) throw new Error("OpenAI API " + response.status + ": " + await response.text());
    const data = await response.json();
    return JSON.parse(extractOutputText(data));
  } catch (error) { console.warn("OpenAI generation failed, using template fallback: " + error.message); return fallbackContent(item, "template-api-fallback"); }
}

async function generateViaProxy(item) {
  const endpoint = process.env.LLM_PROXY_BASE_URL.replace(/\/$/, "") + "/chat/completions";
  const headers = { "Content-Type": "application/json" };
  if (process.env.LLM_PROXY_API_KEY) headers.Authorization = "Bearer " + process.env.LLM_PROXY_API_KEY;
  const input = [prompt, "Business facts JSON:", JSON.stringify(facts), "Keyword request JSON:", JSON.stringify(item), "Return strict JSON only."].join("\n");
  try {
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ model: process.env.LLM_PROXY_MODEL || "local-auction", messages: [{ role: "user", content: input }], temperature: 0.4 }) });
    if (!response.ok) throw new Error("Proxy API " + response.status + ": " + await response.text());
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || data.output_text || "";
    return JSON.parse(text);
  } catch (error) {
    console.warn("Proxy generation failed, using template fallback: " + error.message);
    return fallbackContent(item, "template-proxy-fallback");
  }
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) for (const content of item.content || []) if (typeof content.text === "string") chunks.push(content.text);
  return chunks.join("\n");
}

function fallbackContent(item, mode) {
  const keyword = item.keyword;
  const target = item.page_type === "area" ? keyword + " 상담" : keyword;
  return { generationMode: mode, title: target + " | 주소·사건번호 기반 무료 검토", description: keyword + "을 등기부, 지분율, 공유자 수, 점유 상태, 경매 진행 여부 기준으로 검토하고 매입 가능성과 보류 사유를 안내합니다.", h1: target + " 검토", eyebrow: item.intent || "공유지분 매입 검토", lead: keyword + "은 단순 시세보다 권리관계와 정리 가능성이 중요합니다. 주소나 사건번호만 있어도 1차 검토를 시작할 수 있습니다.", sections: [{ eyebrow: "검토 기준", heading: keyword + "에서 먼저 확인할 항목", summary: "매입 가능 여부는 지분율 하나로 결정되지 않습니다. 등기, 점유, 공유자 구조, 경매 진행 여부를 함께 봅니다.", items: [{ title: "등기부와 지분율", text: "소유자, 지분 비율, 권리 제한, 압류·근저당 등 부담을 확인합니다." }, { title: "공유자 수와 연락 가능성", text: "공유자가 많거나 협의가 어려운 경우 회수 기간과 정리 비용이 달라집니다." }, { title: "점유와 사용 상태", text: "실거주, 임차, 무단점유, 공실 여부는 매입 조건에 직접 영향을 줍니다." }, { title: "경매와 분할 가능성", text: "경매 진행, 우선매수권, 공유물분할 가능성을 별도 기준으로 나눠 봅니다." }] }, { eyebrow: "상담 준비", heading: "자료가 부족해도 접수할 수 있습니다", summary: "처음부터 모든 자료가 없어도 됩니다. 주소, 사건번호, 지분율 중 하나만 있어도 검토 방향을 잡습니다.", items: [{ title: "주소만 있는 경우", text: "소재지 기준으로 등기와 물건 유형을 확인한 뒤 필요한 자료를 안내합니다." }, { title: "사건번호가 있는 경우", text: "법원 사건번호와 물건번호를 기준으로 매각자료와 권리관계를 확인합니다." }, { title: "지분율을 모르는 경우", text: "등기 확인 후 지분율과 공유자 수를 정리해 검토 범위를 좁힙니다." }, { title: "매도 여부가 미정인 경우", text: "매입 가능, 보류, 추가자료 필요 사유를 먼저 안내합니다." }] }], faqs: [{ q: keyword + " 상담은 무엇부터 확인하나요?", a: "등기부, 지분율, 공유자 수, 점유 상태, 경매 진행 여부를 먼저 확인합니다." }, { q: "주소만 있어도 검토가 가능한가요?", a: "가능합니다. 주소나 사건번호만 있어도 1차 검토를 시작할 수 있습니다." }, { q: "상담 후 반드시 매도해야 하나요?", a: "아닙니다. 매입 가능성과 보류 사유를 확인한 뒤 결정하면 됩니다." }, { q: "연락은 어디로 하면 되나요?", a: "상담 폼을 접수하거나 대표번호 1688-0976으로 문의하면 됩니다." }] };
}

function normalizePage(item, generated) { return { slug: item.slug.replace(/^\/+|\/+$/g, ""), keyword: item.keyword, pageType: item.page_type, title: generated.title, description: generated.description, h1: generated.h1, eyebrow: generated.eyebrow || item.intent, lead: generated.lead, sections: generated.sections || [], faqs: generated.faqs || [] }; }
function renderPage(page) {
  const url = siteBase + "/" + page.slug + "/";
  const articleJson = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: page.h1, description: page.description, url, inLanguage: "ko-KR", publisher: { "@type": "Organization", name: facts.site_name, telephone: facts.phone } });
  const faqJson = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: page.faqs.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })) });
  const sections = page.sections.map((section, si) => "<section class=\"band intro-band\"><div class=\"section-head\"><p class=\"eyebrow\">" + escapeHtml(section.eyebrow || "검토 기준") + "</p><h2>" + escapeHtml(section.heading) + "</h2><p>" + escapeHtml(section.summary) + "</p></div><div class=\"metric-grid\">" + (section.items || []).map((item, ii) => "<article><strong>" + String(si * 4 + ii + 1).padStart(2, "0") + "</strong><h3>" + escapeHtml(item.title) + "</h3><p>" + escapeHtml(item.text) + "</p></article>").join("") + "</div></section>").join("\n");
  const faq = page.faqs.map((item) => "<details><summary>" + escapeHtml(item.q) + "</summary><p>" + escapeHtml(item.a) + "</p></details>").join("");
  return "<!doctype html>\n<html lang=\"ko\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>" + escapeHtml(page.title) + "</title>\n  <meta name=\"description\" content=\"" + escapeHtml(page.description) + "\">\n  <meta name=\"robots\" content=\"index,follow,max-image-preview:large\">\n  <link rel=\"canonical\" href=\"" + url + "\">\n  <meta property=\"og:locale\" content=\"ko_KR\">\n  <meta property=\"og:type\" content=\"article\">\n  <meta property=\"og:site_name\" content=\"" + escapeHtml(facts.site_name) + "\">\n  <meta property=\"og:title\" content=\"" + escapeHtml(page.title) + "\">\n  <meta property=\"og:description\" content=\"" + escapeHtml(page.description) + "\">\n  <meta property=\"og:url\" content=\"" + url + "\">\n  <meta property=\"og:image\" content=\"" + siteBase + "/assets/hero-consultation.png\">\n  <meta name=\"twitter:card\" content=\"summary_large_image\">\n  <meta name=\"theme-color\" content=\"#173b35\">\n  <link rel=\"icon\" href=\"/favicon.svg\" type=\"image/svg+xml\">\n  <link rel=\"stylesheet\" href=\"/assets/styles.css?v=20260701-6\">\n  <script type=\"application/ld+json\">" + articleJson + "</script>\n  <script type=\"application/ld+json\">" + faqJson + "</script>\n  <meta name=\"naver-site-verification\" content=\"3bf2b707098dc68bbe5e8db7aad10955cad77bc0\" />\n</head>\n<body>\n  <a class=\"skip-link\" href=\"#main\">본문 바로가기</a>\n  <header class=\"site-header\"><a class=\"brand\" href=\"/\" aria-label=\"" + escapeHtml(facts.site_name) + " 홈\"><span class=\"brand-mark\">J</span><span class=\"brand-text\">Jauction 지분매입</span></a><nav class=\"primary-nav\" aria-label=\"주요 메뉴\"><a href=\"/#screening\">검토 기준</a><a href=\"/#services\">서비스</a><a href=\"/#process\">진행 절차</a><a href=\"/faq/\">FAQ</a></nav><a class=\"header-call\" href=\"tel:" + facts.phone + "\"><i data-lucide=\"phone\"></i><span>" + facts.phone + "</span></a></header>\n  <main id=\"main\"><section class=\"hero\"><div class=\"hero-copy\"><p class=\"eyebrow\">" + escapeHtml(page.eyebrow) + "</p><h1>" + escapeHtml(page.h1) + "</h1><p class=\"lead\">" + escapeHtml(page.lead) + "</p><div class=\"hero-actions\"><a class=\"btn btn-primary\" href=\"/#consult\"><i data-lucide=\"file-search\"></i><span>무료 검토 요청</span></a><a class=\"btn btn-secondary\" href=\"tel:" + facts.phone + "\"><i data-lucide=\"phone-call\"></i><span>" + facts.phone + "</span></a></div></div></section>" + sections + "<section class=\"band faq-band\"><div class=\"section-head\"><p class=\"eyebrow\">FAQ</p><h2>자주 묻는 질문</h2></div><div class=\"faq-list\">" + faq + "</div><p class=\"center-link\"><a href=\"/#consult\">상담 접수로 이동</a></p></section><section class=\"final-cta\"><div><p class=\"eyebrow\">1차 검토 접수</p><h2>주소나 사건번호만 있어도 검토를 시작할 수 있습니다</h2></div><a class=\"btn btn-primary\" href=\"/#consult\"><i data-lucide=\"clipboard-check\"></i><span>검토 요청하기</span></a></section></main><footer class=\"site-footer\"><div><strong>" + escapeHtml(facts.site_name) + "</strong><p>공유물 지분 매입 가능성 검토와 상담 접수를 위한 정적 랜딩 사이트입니다. 구체적인 법률·세무 판단은 사건 자료 확인 후 별도 전문가 검토가 필요할 수 있습니다.</p></div><nav class=\"footer-links\" aria-label=\"하단 메뉴\"><a href=\"/privacy/\">개인정보 처리방침</a><a href=\"/faq/\">FAQ</a><a href=\"tel:" + facts.phone + "\">" + facts.phone + "</a></nav></footer><div class=\"mobile-cta\" aria-label=\"빠른 상담\"><a href=\"tel:" + facts.phone + "\"><i data-lucide=\"phone\"></i><span>전화</span></a><a href=\"/#consult\"><i data-lucide=\"clipboard-check\"></i><span>접수</span></a></div><script src=\"https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js\" defer></script><script src=\"/assets/main.js?v=20260701-6\" defer></script></body></html>\n";
}
function qaPage(page, html) { for (const term of banned) if (html.includes(term)) throw new Error(page.slug + " contains banned term: " + term); for (const required of [facts.phone, "naver-site-verification", "<link rel=\"canonical\"", "/#consult", "FAQPage"]) if (!html.includes(required)) throw new Error(page.slug + " missing " + required); if ((html.match(/<h1>/g) || []).length !== 1) throw new Error(page.slug + " must have one h1"); if (html.length < 5500) throw new Error(page.slug + " content too short"); }
function updateSitemap(pages) { let xml = fs.readFileSync("sitemap.xml", "utf8"); for (const page of pages) { const loc = siteBase + "/" + page.slug + "/"; if (!xml.includes("<loc>" + loc + "</loc>")) xml = xml.replace("</urlset>", "  <url>\n    <loc>" + loc + "</loc>\n    <lastmod>" + today + "</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n</urlset>"); } fs.writeFileSync("sitemap.xml", xml, "utf8"); }
function updateIndexLinks(pages) { const file = "index.html"; let html = fs.readFileSync(file, "utf8"); const marker = "<!-- continuous-indexing-links -->"; const links = pages.map((page) => "<article class=\"service-card\"><h3><a href=\"/" + page.slug + "/\">" + escapeHtml(page.keyword) + "</a></h3><p>지분 매입 검토와 상담 접수로 연결되는 색인 확장 페이지입니다.</p></article>").join(""); if (html.includes(marker)) html = html.replace(new RegExp("<!-- continuous-indexing-links --><div class=\"service-grid\">[\\s\\S]*?</div><!-- /continuous-indexing-links -->"), marker + "<div class=\"service-grid\">" + links + "</div><!-- /continuous-indexing-links -->"); else { const block = "<section class=\"band service-band\" id=\"indexing-hub\"><div class=\"section-head\"><p class=\"eyebrow\">지분매입 색인 허브</p><h2>상황별 지분 상담 페이지를 계속 확장합니다</h2><p>공유지분 매도, 지분경매, 상속지분, 지역별 지분매입 검색 의도에 맞춰 페이지를 지속 발행합니다.</p></div>" + marker + "<div class=\"service-grid\">" + links + "</div><!-- /continuous-indexing-links --></section>"; html = html.replace("    <section class=\"final-cta\">", block + "\n    <section class=\"final-cta\">"); } fs.writeFileSync(file, html, "utf8"); }
function updateOps(published) { fs.mkdirSync("ops", { recursive: true }); const file = "ops/index-state.json"; const state = fs.existsSync(file) ? readJson(file) : { runs: [] }; state.runs.unshift({ date: new Date().toISOString(), model: generationMode === "template" ? "template-cost-safe" : (process.env.LLM_PROXY_BASE_URL ? "proxy" : (allowDirectOpenAI ? model : "template-direct-disabled")), count: published.length, pages: published.map((page) => page.slug) }); state.runs = state.runs.slice(0, 60); writeJson(file, state); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8"); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
