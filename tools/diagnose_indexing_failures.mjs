import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const opsDir = path.join(root, "ops");
const date = kstDate();
const statusPath = path.join(opsDir, "search-console-status.json");
const jsonPath = path.join(opsDir, `search-index-diagnostics-${date}.json`);
const reportPath = path.join(opsDir, `search-index-diagnostics-${date}.md`);

if (!fs.existsSync(statusPath)) {
  throw new Error("ops/search-console-status.json not found. Run tools/sync_search_console_status.mjs first.");
}

const status = readJson(statusPath);
const robots = readRobots();
const sitemapSet = new Set(readSitemapUrls());
const diagnostics = [];

for (const item of status.urls.filter((entry) => entry.active)) {
  diagnostics.push(await diagnoseUrl(item, robots, sitemapSet));
}

const criticalCount = diagnostics.reduce((sum, item) => sum + item.issues.filter((issue) => issue.severity === "critical").length, 0);
const warningCount = diagnostics.reduce((sum, item) => sum + item.issues.filter((issue) => issue.severity === "warning").length, 0);
const result = {
  generatedAt: new Date().toISOString(),
  kstDate: date,
  site: status.site,
  summary: {
    checked: diagnostics.length,
    critical: criticalCount,
    warning: warningCount,
  },
  diagnostics,
};

fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
fs.writeFileSync(reportPath, buildReport(result), "utf8");

if (criticalCount > 0) {
  console.error(`index diagnostics found ${criticalCount} critical issue(s)`);
  process.exitCode = 1;
} else {
  console.log(`index diagnostics passed with ${warningCount} warning(s): ${reportPath}`);
}

async function diagnoseUrl(item, robots, sitemapSet) {
  const live = await checkUrl(item.url);
  const issues = [];
  const url = new URL(item.url);
  const blocked = robots.disallow.some((prefix) => prefix !== "/" && url.pathname.startsWith(prefix));

  if (live.status !== 200) {
    issues.push({ severity: "critical", code: "http_not_200", message: `HTTP status is ${live.status}` });
  }
  if (blocked) {
    issues.push({ severity: "critical", code: "robots_blocked", message: "URL path matches robots.txt Disallow rule" });
  }
  if (live.hasNoindex) {
    issues.push({ severity: "critical", code: "noindex", message: "Page contains noindex robots meta" });
  }
  if (!sitemapSet.has(item.url)) {
    issues.push({ severity: "warning", code: "missing_sitemap", message: "URL is not present in sitemap.xml" });
  }
  if (live.canonical && normalizeUrl(live.canonical) !== normalizeUrl(item.url)) {
    issues.push({ severity: "warning", code: "canonical_mismatch", message: `Canonical points to ${live.canonical}` });
  }
  if (isHtmlLike(item.url) && !live.canonical) {
    issues.push({ severity: "warning", code: "missing_canonical", message: "HTML page has no canonical link" });
  }
  if (isHtmlLike(item.url) && live.bytes > 0 && live.bytes < 3500) {
    issues.push({ severity: "warning", code: "thin_html", message: `HTML response is only ${live.bytes} bytes` });
  }
  if (item.naver?.requestStatus === "ready_to_request" || item.google?.requestStatus === "ready_to_request") {
    issues.push({ severity: "notice", code: "console_submission_pending", message: "Console submission status is still ready_to_request" });
  }

  return {
    url: item.url,
    live,
    inSitemap: sitemapSet.has(item.url),
    issues,
  };
}

async function checkUrl(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "JauctionIndexDiagnostics/1.0",
        "Cache-Control": "no-cache",
      },
    });
    const text = await response.text();
    return {
      status: response.status,
      finalUrl: response.url,
      bytes: Buffer.byteLength(text),
      title: titleOf(text),
      canonical: canonicalOf(text),
      hasNoindex: /<meta\s+name=["']robots["'][^>]*noindex/i.test(text),
    };
  } catch (error) {
    return {
      status: 0,
      finalUrl: "",
      bytes: 0,
      title: "",
      canonical: "",
      hasNoindex: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readRobots() {
  const file = path.join(root, "robots.txt");
  if (!fs.existsSync(file)) return { disallow: [] };
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  return {
    disallow: lines.map((line) => line.trim()).filter((line) => /^Disallow:/i.test(line)).map((line) => line.replace(/^Disallow:\s*/i, "").trim()).filter(Boolean),
  };
}

function readSitemapUrls() {
  const file = path.join(root, "sitemap.xml");
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function buildReport(result) {
  const rows = result.diagnostics.map((item) => {
    const issueText = item.issues.length ? item.issues.map((issue) => `${issue.severity}:${issue.code}`).join(", ") : "clean";
    return `| ${item.live.status} | ${item.inSitemap ? "Y" : "N"} | ${issueText} | ${item.url} |`;
  }).join("\n");
  return `# 색인 실패 진단 리포트 - ${result.kstDate}

## 요약
- 점검 URL: ${result.summary.checked}
- critical: ${result.summary.critical}
- warning: ${result.summary.warning}

## URL별 진단
| Live | Sitemap | 이슈 | URL |
| --- | --- | --- | --- |
${rows}

## 판정
${result.summary.critical ? "기술적 차단 가능성이 있는 URL을 먼저 보완한다." : "기술적 차단 이슈는 없다. 콘솔 제출 및 색인 반영 대기 단계다."}
`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function titleOf(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1].trim()) : "";
}

function canonicalOf(html) {
  const match = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  return match ? match[1] : "";
}

function decodeEntities(value) {
  return String(value).replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"');
}

function isHtmlLike(url) {
  const pathname = new URL(url).pathname;
  return pathname === "/" || pathname.endsWith("/") || pathname.endsWith(".html");
}

function normalizeUrl(url) {
  return String(url).replace(/\/+$/, "") || String(url);
}

function kstDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}
