import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const opsDir = path.join(root, "ops");
const date = kstDate();
const statusPath = path.join(opsDir, "search-console-status.json");
const reportPath = path.join(opsDir, `search-console-status-${date}.md`);
const packPath = latestFile(/^search-index-submission-pack-\d{4}-\d{2}-\d{2}\.json$/);

if (!packPath) {
  throw new Error("No search-index-submission-pack-YYYY-MM-DD.json file found in ops/");
}

const pack = readJson(packPath);
const previous = fs.existsSync(statusPath) ? readJson(statusPath) : {};
const previousByUrl = new Map((previous.urls || []).map((item) => [item.url, item]));
const now = new Date().toISOString();
const sitemapSet = new Set([...(pack.sitemap?.latest || []), ...readSitemapUrls()]);
const feedSet = new Set((pack.feed?.items || []).map((item) => item.link));
const liveByUrl = new Map((pack.liveChecks || []).map((item) => [item.url, item]));

const urls = pack.submissionUrls.map((url, index) => {
  const old = previousByUrl.get(url) || {};
  const live = liveByUrl.get(url) || {};
  return {
    url,
    priority: index + 1,
    active: true,
    firstSeenAt: old.firstSeenAt || now,
    lastCheckedAt: now,
    liveStatus: live.status ?? null,
    title: live.title || old.title || "",
    canonical: live.canonical || old.canonical || "",
    inSitemap: sitemapSet.has(url),
    inFeed: feedSet.has(url),
    naver: old.naver || {
      requestStatus: "ready_to_request",
      consoleStatus: "unknown",
      lastConsoleCheckAt: null,
      note: "",
    },
    google: old.google || {
      requestStatus: "ready_to_request",
      consoleStatus: "unknown",
      lastConsoleCheckAt: null,
      note: "",
    },
  };
});

for (const old of previous.urls || []) {
  if (urls.some((item) => item.url === old.url)) continue;
  urls.push({ ...old, active: false, retiredAt: old.retiredAt || now });
}

const status = {
  version: 1,
  site: pack.site,
  updatedAt: now,
  kstDate: date,
  sourcePack: path.relative(root, packPath).replaceAll("\\", "/"),
  consoles: previous.consoles || {
    naver: {
      property: pack.consoleSubmissions?.naver?.property || pack.site,
      siteVerified: "confirmed",
      sitemapStatus: "ready_to_submit",
      feedStatus: "optional_ready_to_submit",
    },
    google: {
      property: pack.consoleSubmissions?.google?.property || pack.site,
      siteVerified: "needs_console_confirmation",
      sitemapStatus: "ready_to_submit",
    },
  },
  urls,
};

fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
fs.writeFileSync(reportPath, buildReport(status), "utf8");
console.log(`search console status synced: ${reportPath}`);

function latestFile(pattern) {
  if (!fs.existsSync(opsDir)) return "";
  return fs.readdirSync(opsDir)
    .filter((name) => pattern.test(name))
    .sort()
    .map((name) => path.join(opsDir, name))
    .at(-1) || "";
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readSitemapUrls() {
  const file = path.join(root, "sitemap.xml");
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function buildReport(status) {
  const activeUrls = status.urls.filter((item) => item.active);
  const rows = activeUrls.map((item) =>
    `| ${item.priority} | ${item.liveStatus || "-"} | ${item.inSitemap ? "Y" : "N"} | ${item.inFeed ? "Y" : "N"} | ${item.naver.requestStatus} | ${item.google.requestStatus} | ${item.url} |`,
  ).join("\n");
  return `# 검색 콘솔 상태 관리 - ${status.kstDate}

## 현재 상태
- 사이트: \`${status.site}\`
- 기준 제출팩: \`${status.sourcePack}\`
- Naver 소유확인: \`${status.consoles.naver.siteVerified}\`
- Naver sitemap: \`${status.consoles.naver.sitemapStatus}\`
- Google 소유확인: \`${status.consoles.google.siteVerified}\`
- Google sitemap: \`${status.consoles.google.sitemapStatus}\`

## URL별 제출 상태
| 우선순위 | Live | Sitemap | RSS | Naver | Google | URL |
| --- | --- | --- | --- | --- | --- | --- |
${rows}

## 업데이트 규칙
- 콘솔에 제출했으면 해당 URL의 \`naver.requestStatus\` 또는 \`google.requestStatus\`를 \`submitted\`로 바꾼다.
- 콘솔 결과 확인 후 \`consoleStatus\`를 \`success\`, \`pending\`, \`failed\`, \`excluded\` 중 하나로 바꾼다.
- 실패 URL은 \`tools/diagnose_indexing_failures.mjs\`로 원인 후보를 다시 점검한다.
`;
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
