import fs from "node:fs";
import path from "node:path";

const siteBase = "https://jiggyj744-ctrl.github.io";
const root = process.cwd();
const opsDir = path.join(root, "ops");
const date = kstDate();
const reportPath = path.join(opsDir, `search-index-submission-report-${date}.md`);
const jsonPath = path.join(opsDir, `search-index-submission-pack-${date}.json`);
const urlsPath = path.join(opsDir, `search-index-submission-urls-${date}.txt`);

const priorityPaths = [
  "/",
  "/blog/",
  "/blog/address-only-share-consultation/",
  "/blog/unreachable-co-owner-share-options/",
  "/blog/sell-co-owned-share-checklist/",
  "/guide/sell-co-owned-share/",
  "/guide/auction-case-number-review/",
  "/guide/inherited-share-sale/",
  "/services/share-purchase/",
  "/services/share-auction/",
];

const endpoints = [
  "/sitemap.xml",
  "/feed.xml",
  "/robots.txt",
  "/naver1d7f4296c8d516b9f9a69a1b4e6c0904.html",
];

fs.mkdirSync(opsDir, { recursive: true });

const sitemapUrls = readSitemapUrls();
const feedItems = readFeedItems();
const submissionUrls = unique([
  ...priorityPaths.map((item) => siteBase + item),
  ...feedItems.map((item) => item.link),
]).slice(0, 20);

const liveChecks = [];
for (const url of unique([...endpoints.map((item) => siteBase + item), ...submissionUrls])) {
  liveChecks.push(await checkUrl(url));
}

const pack = {
  generatedAt: new Date().toISOString(),
  kstDate: date,
  site: siteBase,
  consoleSubmissions: {
    naver: {
      property: "https://jiggyj744-ctrl.github.io",
      sitemap: `${siteBase}/sitemap.xml`,
      feed: `${siteBase}/feed.xml`,
      note: "Search Advisor에서 sitemap.xml 제출 후 핵심 URL을 웹페이지 수집 요청에 순서대로 넣는다.",
    },
    google: {
      property: "https://jiggyj744-ctrl.github.io",
      sitemap: `${siteBase}/sitemap.xml`,
      note: "Search Console URL-prefix 속성에서 sitemap.xml 제출 후 URL 검사로 핵심 URL 색인 요청을 진행한다.",
    },
  },
  submissionUrls,
  sitemap: {
    count: sitemapUrls.length,
    latest: sitemapUrls.slice(-10),
  },
  feed: {
    count: feedItems.length,
    items: feedItems,
  },
  liveChecks,
  failures: liveChecks.filter((item) => item.status !== 200),
};

fs.writeFileSync(urlsPath, `${submissionUrls.join("\n")}\n`, "utf8");
fs.writeFileSync(jsonPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
fs.writeFileSync(reportPath, buildReport(pack), "utf8");

if (pack.failures.length) {
  console.error(`indexing submission pack created with ${pack.failures.length} failure(s)`);
  process.exitCode = 1;
} else {
  console.log(`indexing submission pack ready: ${reportPath}`);
}

function readSitemapUrls() {
  const file = path.join(root, "sitemap.xml");
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function readFeedItems() {
  const file = path.join(root, "feed.xml");
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
    const item = match[1];
    return {
      title: tag(item, "title"),
      link: tag(item, "link"),
      pubDate: tag(item, "pubDate"),
    };
  }).filter((item) => item.link);
}

function tag(input, name) {
  const match = input.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return match ? decodeEntities(match[1].trim()) : "";
}

async function checkUrl(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "JauctionIndexReadiness/1.0",
        "Cache-Control": "no-cache",
      },
    });
    const text = await response.text();
    return {
      url,
      status: response.status,
      finalUrl: response.url,
      bytes: Buffer.byteLength(text),
      title: titleOf(text),
      canonical: canonicalOf(text),
      naverMeta: /name=["']naver-site-verification["']\s+content=["']3bf2b707098dc68bbe5e8db7aad10955cad77bc0["']/i.test(text),
      hasNoindex: /<meta\s+name=["']robots["'][^>]*noindex/i.test(text),
    };
  } catch (error) {
    return {
      url,
      status: 0,
      finalUrl: "",
      bytes: 0,
      title: "",
      canonical: "",
      naverMeta: false,
      hasNoindex: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"');
}

function buildReport(data) {
  const liveRows = data.liveChecks.map((item) =>
    `| ${item.status} | ${item.url} | ${item.title || "-"} | ${item.hasNoindex ? "noindex" : "indexable"} |`,
  ).join("\n");
  const submissionRows = data.submissionUrls.map((url, index) => `${index + 1}. ${url}`).join("\n");
  const feedRows = data.feed.items.map((item) => `| ${item.pubDate || "-"} | ${item.link} | ${item.title || "-"} |`).join("\n");
  return `# 검색 색인 제출팩 - ${data.kstDate}

## 제출 대상
- Naver Search Advisor 속성: \`${data.consoleSubmissions.naver.property}\`
- Google Search Console 속성: \`${data.consoleSubmissions.google.property}\`
- sitemap: \`${data.consoleSubmissions.naver.sitemap}\`
- feed: \`${data.consoleSubmissions.naver.feed}\`

## 콘솔에서 처리할 순서
1. Naver Search Advisor에서 \`sitemap.xml\` 제출
2. Naver Search Advisor에서 아래 핵심 URL을 웹페이지 수집 요청
3. Google Search Console에서 \`sitemap.xml\` 제출
4. Google Search Console URL 검사에서 아래 핵심 URL 색인 요청
5. 24시간 뒤 수집/색인 상태를 성공, 보류, 실패로 분리 기록

## 핵심 URL 제출 목록
${submissionRows}

## RSS 최신 글
| 발행일 | URL | 제목 |
| --- | --- | --- |
${feedRows}

## 라이브 확인 결과
| 상태 | URL | 제목 | 색인 가능성 |
| --- | --- | --- | --- |
${liveRows}

## 판정
- sitemap URL 수: ${data.sitemap.count}
- RSS item 수: ${data.feed.count}
- 실패 URL 수: ${data.failures.length}
- 결과: ${data.failures.length ? "보완 후 제출" : "콘솔 제출 가능"}
`;
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
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
