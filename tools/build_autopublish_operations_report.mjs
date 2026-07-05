import fs from "node:fs";
import path from "node:path";
import { buildSchedulePreview, kstDate } from "./publish_slot_policy.mjs";

const root = process.cwd();
const opsDir = path.join(root, "ops");
const date = kstDate();
const latestJsonPath = path.join(opsDir, "autopublish-operations-latest.json");
const latestReportPath = path.join(opsDir, "autopublish-operations-latest.md");
const datedReportPath = path.join(opsDir, `autopublish-operations-${date}.md`);
const siteBase = "https://jiggyj744-ctrl.github.io";

fs.mkdirSync(opsDir, { recursive: true });

const blogBacklog = readJsonIfExists("content/blog-backlog.json", { posts: [] });
const indexState = readJsonIfExists("ops/index-state.json", { runs: [] });
const consoleStatus = readJsonIfExists("ops/search-console-status.json", { urls: [], consoles: {} });
const diagnostics = readJsonIfExists(`ops/search-index-diagnostics-${date}.json`, null);
const blogLinkReport = readJsonIfExists(`ops/blog-internal-link-report-${date}.json`, null);
const actions = await latestActions();
const publishedPosts = blogBacklog.posts
  .filter((post) => post.status === "published")
  .sort((a, b) => new Date(b.publishedAt || b.lastPublished || 0) - new Date(a.publishedAt || a.lastPublished || 0));
const queuedPosts = blogBacklog.posts
  .filter((post) => ["queued", "improve"].includes(post.status))
  .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99) || String(a.slug).localeCompare(String(b.slug)));
const todayPublishedRuns = (indexState.runs || []).filter((run) =>
  kstDate(new Date(run.date)) === date &&
  Array.isArray(run.pages) &&
  run.pages.some((page) => String(page).startsWith("blog/")),
);
const latestBlogRun = (indexState.runs || []).find((run) =>
  Array.isArray(run.pages) &&
  run.pages.some((page) => String(page).startsWith("blog/")),
) || null;

const report = {
  generatedAt: new Date().toISOString(),
  kstDate: date,
  site: siteBase,
  summary: {
    publishedBlogPosts: publishedPosts.length,
    queuedBlogPosts: queuedPosts.length,
    publishedToday: todayPublishedRuns.length > 0,
    todayPublishCount: todayPublishedRuns.length,
    latestPublishedUrl: latestBlogRun?.pages?.[0] ? `${siteBase}/${String(latestBlogRun.pages[0]).replace(/^\/+|\/+$/g, "")}/` : "",
    consoleUrls: (consoleStatus.urls || []).filter((item) => item.active).length,
    diagnosticsCritical: diagnostics?.summary?.critical ?? null,
    diagnosticsWarning: diagnostics?.summary?.warning ?? null,
    blogInternalLinkFailures: blogLinkReport ? blogLinkReport.results.filter((item) => !item.ok).length : null,
  },
  policy: {
    dailyLimit: 1,
    selection: "KST 날짜 기반 6개 슬롯 중 1개만 선택",
    primary: "Gemini proxy self-hosted runner, selected slot only, up to 30 minutes jitter",
    fallback: "Hosted template runner, same selected slot only, up to 45 minutes jitter, daily duplicate guard",
    duplicateGuard: "ops/index-state.json의 KST 날짜별 blog/* 발행 여부 확인",
  },
  schedulePreview: buildSchedulePreview(14),
  actions,
  publishedPosts: publishedPosts.map((post) => ({
    title: post.title,
    slug: post.slug,
    publishedAt: post.publishedAt || post.lastPublished || "",
    url: post.url || `${siteBase}/${post.slug}/`,
  })),
  nextQueuedPosts: queuedPosts.slice(0, 12).map((post) => ({
    title: post.title,
    keyword: post.keyword,
    category: post.category,
    priority: post.priority,
    slug: post.slug,
  })),
};

fs.writeFileSync(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
const markdown = buildReport(report);
fs.writeFileSync(latestReportPath, markdown, "utf8");
fs.writeFileSync(datedReportPath, markdown, "utf8");
console.log(`autopublish operations report ready: ${latestReportPath}`);

function buildReport(data) {
  const scheduleRows = data.schedulePreview.map((row) =>
    `| ${row.kstDate} | ${row.selectedSlot} | ${row.primaryWindowKst} | ${row.fallbackWindowKst} |`,
  ).join("\n");
  const actionRows = data.actions.length
    ? data.actions.map((run) => `| ${run.name} | ${run.event} | ${run.status} | ${run.conclusion || "-"} | ${run.created_at || "-"} |`).join("\n")
    : "| - | - | - | - | GitHub Actions API 확인 불가 |";
  const publishedRows = data.publishedPosts.map((post) =>
    `| ${post.publishedAt || "-"} | [${escapePipe(post.title)}](${post.url}) |`,
  ).join("\n");
  const queueRows = data.nextQueuedPosts.map((post) =>
    `| ${post.priority ?? "-"} | ${escapePipe(post.category || "-")} | ${escapePipe(post.keyword || "-")} | ${post.slug} |`,
  ).join("\n");

  return `# 지분매입 자동발행 운영 리포트 - ${data.kstDate}

## 요약
- 발행된 블로그 글: ${data.summary.publishedBlogPosts}
- 대기 중인 블로그 글: ${data.summary.queuedBlogPosts}
- 오늘 KST 발행 여부: ${data.summary.publishedToday ? "Y" : "N"}
- 오늘 발행 횟수: ${data.summary.todayPublishCount}
- 최신 발행 URL: ${data.summary.latestPublishedUrl || "-"}
- 색인 관리 URL: ${data.summary.consoleUrls}
- 색인 critical/warning: ${data.summary.diagnosticsCritical ?? "-"} / ${data.summary.diagnosticsWarning ?? "-"}
- 블로그 내부링크 실패: ${data.summary.blogInternalLinkFailures ?? "-"}

## 발행 정책
- 하루 발행 제한: ${data.policy.dailyLimit}건
- 슬롯 선택: ${data.policy.selection}
- 1차 발행: ${data.policy.primary}
- 보조 발행: ${data.policy.fallback}
- 중복 방지: ${data.policy.duplicateGuard}

## 향후 14일 발행 슬롯
| KST 날짜 | 선택 슬롯 | 1차 발행 창 | 보조 발행 창 |
| --- | --- | --- | --- |
${scheduleRows}

## 최근 GitHub Actions 상태
| Workflow | Event | Status | Conclusion | Created |
| --- | --- | --- | --- | --- |
${actionRows}

## 발행 완료 글
| 발행시각 | 글 |
| --- | --- |
${publishedRows || "| - | - |"}

## 다음 발행 대기 글
| 우선순위 | 카테고리 | 키워드 | Slug |
| --- | --- | --- | --- |
${queueRows || "| - | - | - | - |"}

## 운영 판정
기술 검증은 색인 readiness, 내부링크 검사, 라이브 검증을 통과해야 한다. 실제 색인 반영 여부는 Google Search Console과 Naver Search Advisor의 로그인 콘솔 결과로만 확정한다.
`;
}

async function latestActions() {
  const url = "https://api.github.com/repos/jiggyj744-ctrl/jiggyj744-ctrl.github.io/actions/runs?per_page=8";
  try {
    const response = await fetch(url, { headers: { "User-Agent": "jauction-ops-report" } });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.workflow_runs || []).map((run) => ({
      name: run.name,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      head_sha: run.head_sha,
      created_at: run.created_at,
      html_url: run.html_url,
    }));
  } catch {
    return [];
  }
}

function readJsonIfExists(file, fallback) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) return fallback;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function escapePipe(value) {
  return String(value || "").replaceAll("|", "\\|");
}
