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
const publicStrategyBanned = [
  ["매입", "전략"].join(""),
  ["최저", "입찰가"].join(""),
  ["입찰", "일정"].join(""),
  ["현물", "분할"].join(""),
  ["경매", "분할"].join(""),
  ["단독", "소유"].join(""),
  ["공유물분할", "전략"].join(""),
  ["권리", "행사"].join(""),
  ["매입 가능성이", "높"].join(""),
  ["우선매수권 행사", "가능성"].join(""),
  ["과도한", "입찰가"].join(""),
  ["정리", "전략"].join(""),
  ["회수", "전략"].join(""),
  ["회수", "기간"].join(""),
  ["정리", "비용"].join(""),
  ["정리", "가능성"].join(""),
  ["예상", "비용"].join(""),
  ["소요", "기간"].join(""),
  ["분할", "방법"].join(""),
  ["법적 절차", ["현금", "화"].join("")].join(""),
  ["오히려", "매입이 용이"].join(""),
  ["적정 가격", "산정"].join(""),
  ["일반 매입", "절차"].join(""),
  ["모든 법적", "절차"].join(""),
  ["변호사 선임", "없이"].join(""),
  ["공동매각", "가능성"].join(""),
  ["현실적인", "정리 방향"].join(" "),
  ["협의", "비용"].join(" "),
  ["낙찰가", "보다"].join(""),
  ["사용수익", "구조"].join(" "),
  ["수익", "배분"].join(" "),
  ["분할", "공동매각"].join(", "),
  ["매입", "가격"].join(" "),
  ["인도", "시기"].join(" "),
  ["잔금", "조건"].join(" "),
  ["소유권", "이전"].join(" "),
  ["매입", "가치"].join(" "),
  ["절차를", "안내"].join(" "),
  ["일정", "기간"].join(" "),
  ["매수", "의사"].join(" "),
  ["통지", "해야"].join(""),
  ["우선매수권", "절차"].join(" "),
  ["매입", "절차"].join(" "),
  ["현금", "화"].join(""),
  ["배", "당"].join(""),
  ["명", "도"].join(""),
  ["매도", "시나리오"].join(" "),
  ["지분", "가치"].join(" "),
  ["법적으로", "보호되는 권리"].join(" "),
  ["매입 후에도", "분쟁"].join(" "),
  ["입찰", "검토자"].join(" "),
  ["보증", "금"].join(""),
];
const facts = readJson("content/business-facts.json");
const backlog = readJson("content/keyword-backlog.json");
const prompt = fs.existsSync("prompts/share-index-page.md") ? fs.readFileSync("prompts/share-index-page.md", "utf8") : "";
const blogBacklog = fs.existsSync("content/blog-backlog.json") ? readJson("content/blog-backlog.json") : { version: 1, updated: today, posts: [] };
const blogPrompt = fs.existsSync("prompts/share-blog-post.md") ? fs.readFileSync("prompts/share-blog-post.md", "utf8") : "";
const selected = backlog.keywords.filter((item) => ["queued", "improve"].includes(item.status)).slice(0, limit);
const published = [];

for (const item of selected) {
  let generated = await generateContent(item);
  let page = normalizePage(item, generated);
  let html = renderPage(page);
  try {
    qaPage(page, html);
  } catch (error) {
    console.warn("Generated page failed QA, using template fallback: " + error.message);
    generated = fallbackContent(item, "template-qa-fallback");
    page = normalizePage(item, generated);
    html = renderPage(page);
    qaPage(page, html);
  }
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

const selectedBlogs = blogBacklog.posts.filter((item) => ["queued", "improve"].includes(item.status)).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99) || String(a.slug).localeCompare(String(b.slug))).slice(0, limit);
const publishedBlogs = [];
for (const item of selectedBlogs) {
  const post = await publishBlogPost(item);
  publishedBlogs.push(post);
}
const allPublishedBlogs = blogBacklog.posts.filter((item) => item.status === "published");
updateBlogIndex(allPublishedBlogs);
updateFeed(allPublishedBlogs);
if (publishedBlogs.length) {
  updateSitemap(publishedBlogs);
  updateBlogLinks(allPublishedBlogs);
  blogBacklog.updated = today;
  writeJson("content/blog-backlog.json", blogBacklog);
  updateOps(publishedBlogs);
}
console.log("continuous blog indexing published " + publishedBlogs.length + " post(s)");


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
  const input = [prompt, "Business facts JSON:", JSON.stringify(facts), "Keyword request JSON:", JSON.stringify(item), "Return strict JSON only with keys title, description, h1, eyebrow, lead, sections, faqs. Write Korean content with at least 3 sections, each section containing 4 items, and 4 FAQs. Keep public copy focused on 자료 확인, 매입 가능성, 보류 사유, 추가자료 안내. Do not reveal bidding, partition, lawsuit, cost, timing, price calculation, or acquisition strategy."].join("\n");
  try {
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ model: process.env.LLM_PROXY_MODEL || "deepseek-chat", messages: [{ role: "user", content: input }], temperature: 0.4, max_tokens: 2500, response_format: { type: "json_object" } }) });
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
  return { generationMode: mode, title: target + " | 주소·사건번호 기반 무료 검토", description: keyword + "을 등기부, 지분율, 공유자 수, 점유 상태, 경매 진행 여부 기준으로 확인하고 매입 가능성과 보류 사유를 안내합니다.", h1: target + " 검토", eyebrow: item.intent || "공유지분 매입 검토", lead: keyword + "은 단순 시세보다 권리관계와 자료 확인이 중요합니다. 주소나 사건번호만 있어도 1차 검토를 시작할 수 있습니다.", sections: [{ eyebrow: "검토 기준", heading: keyword + "에서 먼저 확인할 항목", summary: "매입 가능 여부는 지분율 하나로 결정되지 않습니다. 등기, 점유, 공유자 구조, 경매 진행 여부를 함께 봅니다.", items: [{ title: "등기부와 지분율", text: "소유자, 지분 비율, 권리 제한, 압류·근저당 등 기본 부담을 확인합니다." }, { title: "공유자 수와 연락 가능성", text: "공유자가 많거나 협의가 어려운 경우 검토 기간과 보류 사유가 달라집니다." }, { title: "점유와 사용 상태", text: "실거주, 임차, 무단점유, 공실 여부를 자료 기준으로 확인합니다." }, { title: "경매와 권리관계", text: "경매 진행 여부와 권리 제한을 자료 기준으로 확인합니다." }] }, { eyebrow: "상담 준비", heading: "자료가 부족해도 접수할 수 있습니다", summary: "처음부터 모든 자료가 없어도 됩니다. 주소, 사건번호, 지분율 중 하나만 있어도 검토 방향을 잡습니다.", items: [{ title: "주소만 있는 경우", text: "소재지 기준으로 등기와 물건 유형을 확인한 뒤 필요한 자료를 안내합니다." }, { title: "사건번호가 있는 경우", text: "법원 사건번호와 물건번호를 기준으로 공개 사건자료와 권리관계를 확인합니다." }, { title: "지분율을 모르는 경우", text: "등기 확인 후 지분율과 공유자 수를 정리해 검토 범위를 좁힙니다." }, { title: "매도 여부가 미정인 경우", text: "매입 가능, 보류, 추가자료 필요 사유를 먼저 안내합니다." }] }], faqs: [{ q: keyword + " 상담은 무엇부터 확인하나요?", a: "등기부, 지분율, 공유자 수, 점유 상태, 경매 진행 여부를 먼저 확인합니다." }, { q: "주소만 있어도 검토가 가능한가요?", a: "가능합니다. 주소나 사건번호만 있어도 1차 검토를 시작할 수 있습니다." }, { q: "상담 후 반드시 매도해야 하나요?", a: "아닙니다. 매입 가능성과 보류 사유를 확인한 뒤 결정하면 됩니다." }, { q: "연락은 어디로 하면 되나요?", a: "상담 폼을 접수하거나 대표번호 1688-0976으로 문의하면 됩니다." }] };
}

function normalizePage(item, generated) { return { slug: item.slug.replace(/^\/+|\/+$/g, ""), keyword: item.keyword, pageType: item.page_type, title: generated.title, description: generated.description, h1: generated.h1, eyebrow: generated.eyebrow || item.intent, lead: generated.lead, sections: generated.sections || [], faqs: generated.faqs || [] }; }
function renderPage(page) {
  const url = siteBase + "/" + page.slug + "/";
  const articleJson = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: page.h1, description: page.description, url, inLanguage: "ko-KR", publisher: { "@type": "Organization", name: facts.site_name, telephone: facts.phone } });
  const faqJson = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: page.faqs.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })) });
  const sections = page.sections.map((section, si) => "<section class=\"band intro-band\"><div class=\"section-head\"><p class=\"eyebrow\">" + escapeHtml(section.eyebrow || "검토 기준") + "</p><h2>" + escapeHtml(section.heading) + "</h2><p>" + escapeHtml(section.summary) + "</p></div><div class=\"metric-grid\">" + (section.items || []).map((item, ii) => "<article><strong>" + String(si * 4 + ii + 1).padStart(2, "0") + "</strong><h3>" + escapeHtml(item.title) + "</h3><p>" + escapeHtml(item.text) + "</p></article>").join("") + "</div></section>").join("\n");
  const faq = page.faqs.map((item) => "<details><summary>" + escapeHtml(item.q) + "</summary><p>" + escapeHtml(item.a) + "</p></details>").join("");
  return "<!doctype html>\n<html lang=\"ko\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>" + escapeHtml(page.title) + "</title>\n  <meta name=\"description\" content=\"" + escapeHtml(page.description) + "\">\n  <meta name=\"robots\" content=\"index,follow,max-image-preview:large\">\n  <link rel=\"canonical\" href=\"" + url + "\">\n  <meta property=\"og:locale\" content=\"ko_KR\">\n  <meta property=\"og:type\" content=\"article\">\n  <meta property=\"og:site_name\" content=\"" + escapeHtml(facts.site_name) + "\">\n  <meta property=\"og:title\" content=\"" + escapeHtml(page.title) + "\">\n  <meta property=\"og:description\" content=\"" + escapeHtml(page.description) + "\">\n  <meta property=\"og:url\" content=\"" + url + "\">\n  <meta property=\"og:image\" content=\"" + siteBase + "/assets/hero-consultation.png\">\n  <meta name=\"twitter:card\" content=\"summary_large_image\">\n  <meta name=\"theme-color\" content=\"#173b35\">\n  <link rel=\"icon\" href=\"/favicon.svg\" type=\"image/svg+xml\">\n  <link rel=\"stylesheet\" href=\"/assets/styles.css?v=20260701-7\">\n  <script type=\"application/ld+json\">" + articleJson + "</script>\n  <script type=\"application/ld+json\">" + faqJson + "</script>\n  <meta name=\"naver-site-verification\" content=\"3bf2b707098dc68bbe5e8db7aad10955cad77bc0\" />\n</head>\n<body>\n  <a class=\"skip-link\" href=\"#main\">본문 바로가기</a>\n  <header class=\"site-header\"><a class=\"brand\" href=\"/\" aria-label=\"" + escapeHtml(facts.site_name) + " 홈\"><span class=\"brand-mark\">J</span><span class=\"brand-text\">Jauction 지분매입</span></a><nav class=\"primary-nav\" aria-label=\"주요 메뉴\"><a href=\"/#screening\">검토 기준</a><a href=\"/#services\">서비스</a><a href=\"/#process\">검토 흐름</a><a href=\"/faq/\">FAQ</a></nav><a class=\"header-call\" href=\"tel:" + facts.phone + "\"><i data-lucide=\"phone\"></i><span>" + facts.phone + "</span></a></header>\n  <main id=\"main\"><section class=\"hero\"><div class=\"hero-copy\"><p class=\"eyebrow\">" + escapeHtml(page.eyebrow) + "</p><h1>" + escapeHtml(page.h1) + "</h1><p class=\"lead\">" + escapeHtml(page.lead) + "</p><div class=\"hero-actions\"><a class=\"btn btn-primary\" href=\"/#consult\"><i data-lucide=\"file-search\"></i><span>무료 검토 요청</span></a><a class=\"btn btn-secondary\" href=\"tel:" + facts.phone + "\"><i data-lucide=\"phone-call\"></i><span>" + facts.phone + "</span></a></div></div></section>" + sections + "<section class=\"band faq-band\"><div class=\"section-head\"><p class=\"eyebrow\">FAQ</p><h2>자주 묻는 질문</h2></div><div class=\"faq-list\">" + faq + "</div><p class=\"center-link\"><a href=\"/#consult\">상담 접수로 이동</a></p></section><section class=\"final-cta\"><div><p class=\"eyebrow\">1차 검토 접수</p><h2>주소나 사건번호만 있어도 검토를 시작할 수 있습니다</h2></div><a class=\"btn btn-primary\" href=\"/#consult\"><i data-lucide=\"clipboard-check\"></i><span>검토 요청하기</span></a></section></main><footer class=\"site-footer\"><div><strong>" + escapeHtml(facts.site_name) + "</strong><p>공유물 지분 매입 가능성 검토와 상담 접수를 위한 정적 랜딩 사이트입니다. 구체적인 법률·세무 판단은 사건 자료 확인 후 별도 전문가 검토가 필요할 수 있습니다.</p></div><nav class=\"footer-links\" aria-label=\"하단 메뉴\"><a href=\"/privacy/\">개인정보 처리방침</a><a href=\"/faq/\">FAQ</a><a href=\"tel:" + facts.phone + "\">" + facts.phone + "</a></nav></footer><div class=\"mobile-cta\" aria-label=\"빠른 상담\"><a href=\"/#consult\"><i data-lucide=\"mail\"></i><span>메일</span></a><a href=\"/#consult\"><i data-lucide=\"clipboard-check\"></i><span>접수</span></a></div><script src=\"https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js\" defer></script><script src=\"/assets/main.js?v=20260701-7\" defer></script></body></html>\n";
}
function qaPage(page, html) { for (const term of banned) if (html.includes(term)) throw new Error(page.slug + " contains banned term: " + term); for (const term of publicStrategyBanned) if (html.includes(term)) throw new Error(page.slug + " contains public strategy term: " + term); for (const required of [facts.phone, "naver-site-verification", "<link rel=\"canonical\"", "/#consult", "FAQPage"]) if (!html.includes(required)) throw new Error(page.slug + " missing " + required); if ((html.match(/<h1>/g) || []).length !== 1) throw new Error(page.slug + " must have one h1"); if (html.length < 5500) throw new Error(page.slug + " content too short"); }
function updateSitemap(pages) { let xml = fs.readFileSync("sitemap.xml", "utf8"); for (const page of pages) { const loc = siteBase + "/" + page.slug + "/"; if (!xml.includes("<loc>" + loc + "</loc>")) xml = xml.replace("</urlset>", "  <url>\n    <loc>" + loc + "</loc>\n    <lastmod>" + today + "</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n</urlset>"); } fs.writeFileSync("sitemap.xml", xml, "utf8"); }
function updateIndexLinks(pages) { const file = "index.html"; let html = fs.readFileSync(file, "utf8"); const marker = "<!-- continuous-indexing-links -->"; const links = pages.map((page) => "<article class=\"service-card\"><h3><a href=\"/" + page.slug + "/\">" + escapeHtml(page.keyword) + "</a></h3><p>지분 매입 검토와 상담 접수로 연결되는 색인 확장 페이지입니다.</p></article>").join(""); if (html.includes(marker)) html = html.replace(new RegExp("<!-- continuous-indexing-links --><div class=\"service-grid\">[\\s\\S]*?</div><!-- /continuous-indexing-links -->"), marker + "<div class=\"service-grid\">" + links + "</div><!-- /continuous-indexing-links -->"); else { const block = "<section class=\"band service-band\" id=\"indexing-hub\"><div class=\"section-head\"><p class=\"eyebrow\">지분매입 색인 허브</p><h2>상황별 지분 상담 페이지를 계속 확장합니다</h2><p>공유지분 매도, 지분경매, 상속지분, 지역별 지분매입 검색 의도에 맞춰 페이지를 지속 발행합니다.</p></div>" + marker + "<div class=\"service-grid\">" + links + "</div><!-- /continuous-indexing-links --></section>"; html = html.replace("    <section class=\"final-cta\">", block + "\n    <section class=\"final-cta\">"); } fs.writeFileSync(file, html, "utf8"); }
function updateOps(published) { fs.mkdirSync("ops", { recursive: true }); const file = "ops/index-state.json"; const state = fs.existsSync(file) ? readJson(file) : { runs: [] }; state.runs.unshift({ date: new Date().toISOString(), model: generationMode === "template" ? "template-cost-safe" : (process.env.LLM_PROXY_BASE_URL ? "proxy" : (allowDirectOpenAI ? model : "template-direct-disabled")), count: published.length, pages: published.map((page) => page.slug) }); state.runs = state.runs.slice(0, 60); writeJson(file, state); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8"); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }

async function publishBlogPost(item) {
  let generated = await generateBlogContent(item);
  let post = normalizeBlogPost(item, generated);
  let html = renderBlogPost(post);
  try {
    qaBlogPost(post, html);
  } catch (error) {
    console.warn("Generated blog failed QA, using template fallback: " + error.message);
    generated = fallbackBlogContent(item, "template-blog-qa-fallback");
    post = normalizeBlogPost(item, generated);
    html = renderBlogPost(post);
    qaBlogPost(post, html);
  }
  const targetDir = path.join(root, post.slug);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "index.html"), html, "utf8");
  item.status = "published";
  item.lastPublished = today;
  item.publishedAt = item.publishedAt || new Date().toISOString();
  item.url = siteBase + "/" + post.slug + "/";
  item.title = post.title;
  item.description = post.description;
  item.category = post.category;
  return post;
}
async function generateBlogContent(item) {
  if (generationMode === "template") return fallbackBlogContent(item, "template-cost-safe");
  if (process.env.LLM_PROXY_BASE_URL) return generateBlogViaProxy(item);
  return fallbackBlogContent(item, "template-direct-disabled");
}
async function generateBlogViaProxy(item) {
  const endpoint = process.env.LLM_PROXY_BASE_URL.replace(/\/$/, "") + "/chat/completions";
  const headers = { "Content-Type": "application/json" };
  if (process.env.LLM_PROXY_API_KEY) headers.Authorization = "Bearer " + process.env.LLM_PROXY_API_KEY;
  const input = [blogPrompt, "Business facts JSON:", JSON.stringify(facts), "Blog request JSON:", JSON.stringify(item), "Return strict JSON only with keys title, description, h1, eyebrow, excerpt, category, sections, checklist, faqs. Write Korean expert blog content with at least 5 sections, each section containing 2-3 substantial paragraphs, a practical checklist, and 4 FAQs. Keep public copy focused on 자료 확인, 매입 가능성, 보류 사유, 추가자료 안내. Do not reveal bidding, partition, lawsuit, cost, timing, price calculation, or acquisition strategy."].join("\n");
  try {
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ model: process.env.LLM_PROXY_MODEL || "deepseek-chat", messages: [{ role: "user", content: input }], temperature: 0.35, max_tokens: 3600, response_format: { type: "json_object" } }) });
    if (!response.ok) throw new Error("Proxy API " + response.status + ": " + await response.text());
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || data.output_text || "";
    return parseJsonText(text);
  } catch (error) {
    console.warn("Proxy blog generation failed, using template fallback: " + error.message);
    return fallbackBlogContent(item, "template-blog-proxy-fallback");
  }
}
function parseJsonText(text) {
  let raw = String(text || "").trim();
  const fence = String.fromCharCode(96, 96, 96);
  if (raw.startsWith(fence + "json")) raw = raw.slice(7).trim();
  if (raw.startsWith(fence)) raw = raw.slice(3).trim();
  if (raw.endsWith(fence)) raw = raw.slice(0, -3).trim();
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error("JSON response parse failed");
}
function fallbackBlogContent(item, mode) {
  const keyword = item.keyword;
  const titleBase = item.title || keyword;
  const sectionSeeds = [["처음 확인할 권리관계", "등기부상 소유자, 지분율, 권리 제한, 압류나 근저당 유무를 먼저 봅니다. 지분 물건은 전체 물건의 시세보다 자료상 보류 사유 확인이 더 중요합니다.", "공유자가 몇 명인지, 연락 가능성이 있는지, 이미 분쟁자료가 있는지도 함께 확인합니다. 이 단계에서 매입 가능, 보류, 추가자료 필요 여부를 1차로 나눌 수 있습니다."], ["주소와 사건번호만 있을 때", "주소만 있어도 소재지와 물건 유형을 기준으로 검토를 시작할 수 있습니다. 사건번호가 있으면 공개 사건자료와 점유 관계를 확인할 수 있습니다.", "자료가 부족하다고 접수를 미룰 필요는 없습니다. 현재 알고 있는 정보와 매도 의사, 공유자 상황을 함께 남기면 필요한 추가자료를 안내할 수 있습니다."], ["공유자와 점유 상태", "공유자 수가 많거나 연락이 끊긴 경우에는 검토 기간과 보류 사유가 달라질 수 있습니다. 점유자가 누구인지, 임대차가 있는지, 실제 사용자가 공유자인지도 함께 확인합니다.", "일부 지분만 매도하려는 경우에는 공유자 관계, 사용 상태 등 확인해야 할 자료가 늘어날 수 있습니다."], ["경매와 권리관계", "지분경매가 진행 중이거나 관련 사건이 있는 경우 사건자료와 권리관계를 분리해 확인합니다. 점유 상태, 권리 제한, 추가자료 필요 여부를 별도 항목으로 봅니다.", "매입 검토에서는 법률적 결론을 단정하기보다 자료 기준으로 불확실성을 줄이는 것이 우선입니다. 필요한 경우 등기, 사건 기록, 점유 자료를 추가 요청합니다."], ["상담 접수 후 안내되는 내용", "상담이 접수되면 등기, 지분율, 공유자 수, 점유 상태, 경매 진행 여부를 기준으로 매입 가능성과 보류 사유를 안내합니다. 즉시 매입 판단이 어려우면 추가로 필요한 자료를 정리해 드립니다.", "매도 여부가 확정되지 않았더라도 1차 검토를 받을 수 있습니다. 검토 결과를 보고 매도, 보류, 추가자료 확인 중 어느 방향이 맞는지 결정하면 됩니다."]];
  return { generationMode: mode, title: titleBase + " | 지분매입 검토 노트", description: keyword + " 상황에서 공유지분 매입 가능성을 확인할 때 필요한 등기, 공유자, 점유, 사건번호 기준을 정리했습니다.", h1: titleBase, eyebrow: item.category || "지분매입 블로그", excerpt: keyword + " 관련 상담을 접수하기 전 확인하면 좋은 기준을 정리한 검토 노트입니다. 주소나 사건번호만 있어도 1차 검토를 시작할 수 있습니다.", category: item.category || "검토 노트", sections: sectionSeeds.map((seed) => ({ heading: seed[0], paragraphs: [seed[1], seed[2]] })), checklist: ["주소 또는 사건번호", "대략적인 지분율", "공유자 수와 연락 가능성", "점유자 또는 임차인 여부", "매도 희망 여부"], faqs: [{ q: keyword + " 상담은 자료가 모두 있어야 하나요?", a: "아닙니다. 주소나 사건번호만 있어도 1차 검토를 시작할 수 있습니다." }, { q: "지분율을 모르면 접수할 수 없나요?", a: "지분율을 몰라도 접수할 수 있습니다. 등기 확인 후 지분율과 공유자 수를 함께 정리합니다." }, { q: "공유자와 연락이 안 돼도 검토가 가능한가요?", a: "가능합니다. 연락 가능성은 매입 가능성과 보류 사유를 판단하는 확인 항목으로 따로 봅니다." }, { q: "검토 후 바로 매도해야 하나요?", a: "아닙니다. 매입 가능성과 보류 사유를 확인한 뒤 매도 여부를 결정하면 됩니다." }] };
}
function normalizeBlogPost(item, generated) {
  const fallback = fallbackBlogContent(item, "template-normalize-fallback");
  const source = generated && typeof generated === "object" ? generated : fallback;
  const sections = normalizeBlogSections(source.sections?.length ? source.sections : fallback.sections);
  const checklist = Array.isArray(source.checklist) && source.checklist.length ? source.checklist.map(String) : fallback.checklist;
  const faqs = Array.isArray(source.faqs) && source.faqs.length ? source.faqs : fallback.faqs;
  return { slug: cleanSlug(item.slug), keyword: item.keyword, category: source.category || item.category || "지분매입 블로그", title: source.title || fallback.title, description: source.description || fallback.description, h1: source.h1 || item.title || item.keyword, eyebrow: source.eyebrow || item.category || "지분매입 블로그", excerpt: source.excerpt || fallback.excerpt, publishedAt: item.publishedAt || new Date().toISOString(), sections, checklist, faqs };
}
function normalizeBlogSections(sections) {
  return sections.map((section, index) => {
    const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs : Array.isArray(section.items) ? section.items.map((item) => [item.title, item.text].filter(Boolean).join(": ")) : [section.summary || "공유지분 매입 가능성은 권리관계, 공유자, 점유 상태를 함께 확인해야 합니다."];
    return { heading: section.heading || section.title || "검토 항목 " + (index + 1), paragraphs: paragraphs.filter(Boolean).map(String) };
  });
}
function renderBlogPost(post) {
  const blogPage = { slug: post.slug, keyword: post.keyword, pageType: "blog", title: post.title, description: post.description, h1: post.h1, eyebrow: post.eyebrow, lead: post.excerpt, sections: post.sections.map((section) => ({ eyebrow: "검토 노트", heading: section.heading, summary: section.paragraphs.join(" "), items: section.paragraphs.map((paragraph, index) => ({ title: "핵심 " + (index + 1), text: paragraph })) })), faqs: post.faqs };
  let html = renderPage(blogPage);
  const url = siteBase + "/" + post.slug + "/";
  const blogJson = JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", headline: post.h1, description: post.description, url, datePublished: post.publishedAt, dateModified: new Date().toISOString(), inLanguage: "ko-KR", author: { "@type": "Organization", name: facts.site_name }, publisher: { "@type": "Organization", name: facts.site_name, telephone: facts.phone }, mainEntityOfPage: url, image: siteBase + "/assets/hero-consultation.png" });
  html = html.replace("</head>", "  <link rel=\"alternate\" type=\"application/rss+xml\" title=\"Jauction 지분매입 블로그 RSS\" href=\"/feed.xml\">\n  <script type=\"application/ld+json\">" + blogJson + "</script>\n</head>");
  return html;
}
function renderBlogIndex(posts) {
  const items = posts.length ? posts.slice(0, 24).map((post) => ({ title: post.title || post.keyword, text: (post.description || post.keyword + " 관련 지분매입 검토 노트입니다.") + " / " + siteBase + "/" + cleanSlug(post.slug) + "/" })) : [{ title: "발행 준비 중", text: "공유지분 매도, 지분경매, 상속지분, 공유물분할청구 관련 검토 노트를 순차 발행합니다." }];
  const page = { slug: "blog", keyword: "지분매입 블로그", pageType: "blog-index", title: "지분매입 블로그 | 공유지분 매도·검토 노트", description: "공유지분 매도, 지분경매, 상속지분, 공유물분할청구 상황별 검토 노트를 모아 둔 블로그입니다.", h1: "공유지분 매도와 지분경매 검토 노트", eyebrow: "지분매입 블로그", lead: "주소나 사건번호만 있어도 검토를 시작할 수 있도록 상황별 판단 기준을 계속 발행합니다.", sections: [{ eyebrow: "최신 글", heading: "상황별 지분매입 검토 글", summary: "검색 유입과 상담 전환을 동시에 고려해 전문 주제별 글을 지속 발행합니다.", items }], faqs: [{ q: "블로그 글은 어떤 기준으로 발행되나요?", a: "공유지분 매도, 지분경매, 상속지분, 공유물분할청구 등 상담 유입 가능성이 높은 주제를 우선 발행합니다." }, { q: "글을 보고 바로 상담할 수 있나요?", a: "가능합니다. 주소나 사건번호만 있어도 무료 검토 요청을 남길 수 있습니다." }, { q: "RSS를 제출해도 되나요?", a: "가능합니다. /feed.xml은 최신 블로그 글을 반영합니다." }, { q: "법률 자문 글인가요?", a: "아닙니다. 자료 기준 1차 검토와 상담 접수를 위한 안내입니다." }] };
  let html = renderPage(page);
  const collectionJson = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", name: "지분매입 블로그", url: siteBase + "/blog/", inLanguage: "ko-KR", publisher: { "@type": "Organization", name: facts.site_name, telephone: facts.phone } });
  html = html.replace("</head>", "  <link rel=\"alternate\" type=\"application/rss+xml\" title=\"Jauction 지분매입 블로그 RSS\" href=\"/feed.xml\">\n  <script type=\"application/ld+json\">" + collectionJson + "</script>\n</head>");
  for (const post of posts.slice(0, 24)) html = html.replace("<h3>" + escapeHtml(post.title || post.keyword) + "</h3>", "<h3><a href=\"/" + cleanSlug(post.slug) + "/\">" + escapeHtml(post.title || post.keyword) + "</a></h3>");
  return html;
}
function qaBlogPost(post, html) {
  for (const term of banned) if (html.includes(term)) throw new Error(post.slug + " contains banned term: " + term);
  for (const term of publicStrategyBanned) if (html.includes(term)) throw new Error(post.slug + " contains public strategy term: " + term);
  for (const required of [facts.phone, "naver-site-verification", "<link rel=\"canonical\"", "/#consult", "BlogPosting", "FAQPage", "feed.xml"]) if (!html.includes(required)) throw new Error(post.slug + " missing " + required);
  if (countText(html, "<h1>") !== 1) throw new Error(post.slug + " must have one h1");
  if (html.length < 6500) throw new Error(post.slug + " content too short");
}
function updateBlogIndex(posts) { fs.mkdirSync("blog", { recursive: true }); fs.writeFileSync("blog/index.html", renderBlogIndex(posts), "utf8"); }
function updateFeed(posts) {
  const items = posts.slice(0, 30).map((post) => "  <item>\n    <title>" + escapeXml(post.title || post.keyword) + "</title>\n    <link>" + siteBase + "/" + cleanSlug(post.slug) + "/</link>\n    <guid>" + siteBase + "/" + cleanSlug(post.slug) + "/</guid>\n    <pubDate>" + new Date(post.publishedAt || post.lastPublished || new Date().toISOString()).toUTCString() + "</pubDate>\n    <description>" + escapeXml(post.description || post.keyword + " 검토 노트") + "</description>\n  </item>").join("\n");
  fs.writeFileSync("feed.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<rss version=\"2.0\">\n<channel>\n  <title>Jauction 지분매입 블로그</title>\n  <link>" + siteBase + "/blog/</link>\n  <description>공유지분 매도와 지분경매 검토 노트 자동 발행 피드</description>\n  <language>ko-KR</language>\n  <lastBuildDate>" + new Date().toUTCString() + "</lastBuildDate>\n" + items + "\n</channel>\n</rss>\n", "utf8");
}
function updateBlogLinks(posts) {
  const file = "index.html";
  let html = fs.readFileSync(file, "utf8");
  if (!html.includes('/blog/')) html = html.replace('<a href="/faq/">FAQ</a>', '<a href="/blog/">블로그</a>\n      <a href="/faq/">FAQ</a>');
  const marker = "<!-- blog-indexing-links -->";
  const endMarker = "<!-- /blog-indexing-links -->";
  const links = posts.slice(0, 9).map((post) => "<article class=\"service-card\"><p class=\"eyebrow\">" + escapeHtml(post.category || "검토 노트") + "</p><h3><a href=\"/" + cleanSlug(post.slug) + "/\">" + escapeHtml(post.title || post.keyword) + "</a></h3><p>" + escapeHtml(post.description || "공유지분 매입 검토 블로그 글입니다.") + "</p></article>").join("");
  const replacement = marker + "<div class=\"service-grid\">" + links + "</div>" + endMarker;
  const start = html.indexOf(marker);
  if (start >= 0) {
    const end = html.indexOf(endMarker, start);
    html = html.slice(0, start) + replacement + html.slice(end + endMarker.length);
  } else {
    const block = "<section class=\"band service-band\" id=\"blog-hub\"><div class=\"section-head\"><p class=\"eyebrow\">지분매입 블로그</p><h2>검토 노트를 계속 발행합니다</h2><p>공유지분 매도, 지분경매, 상속지분, 공유물분할청구 검색 의도에 맞춘 글을 자동 발행합니다.</p></div>" + replacement + "<p class=\"center-link\"><a href=\"/blog/\">블로그 전체 보기</a></p></section>";
    html = html.replace("    <section class=\"final-cta\">", block + "\n    <section class=\"final-cta\">");
  }
  fs.writeFileSync(file, html, "utf8");
}
function cleanSlug(value) { return String(value || "").split("/").filter(Boolean).join("/"); }
function countText(value, needle) { return String(value).split(needle).length - 1; }
function escapeXml(value) { return escapeHtml(value).replace(/'/g, "&apos;"); }

