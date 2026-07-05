import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const date = kstDate();
const checkOnly = process.argv.includes("--check");
const minRelated = 4;

if (!checkOnly) {
  const rebuild = spawnSync(process.execPath, ["scripts/seo-content-engine.mjs", "--rebuild-blog-only"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PUBLISH_SCOPE: "blog" },
  });
  if (rebuild.status !== 0) {
    process.exit(rebuild.status ?? 1);
  }
}

const posts = readBlogPosts();
const results = posts.map((post) => inspectPost(post, posts));
const failures = results.filter((item) => !item.ok);
const jsonPath = path.join(root, "ops", `blog-internal-link-report-${date}.json`);
const reportPath = path.join(root, "ops", `blog-internal-link-report-${date}.md`);
fs.mkdirSync(path.join(root, "ops"), { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), checkOnly, minRelated, results }, null, 2)}\n`, "utf8");
fs.writeFileSync(reportPath, buildReport(results), "utf8");

if (failures.length) {
  console.error(`blog internal link check failed for ${failures.length} post(s)`);
  process.exitCode = 1;
} else {
  console.log(`blog internal links ready: ${reportPath}`);
}

function readBlogPosts() {
  const dir = path.join(root, "content", "blog-posts");
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")))
    .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
}

function inspectPost(post, allPosts) {
  const htmlPath = path.join(root, post.slug, "index.html");
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf8") : "";
  const expected = Math.min(minRelated, Math.max(0, allPosts.length - 1));
  const selfHref = `/${post.slug.replace(/^\/+|\/+$/g, "")}/`;
  const relatedLinks = unique([...html.matchAll(/href="(\/blog\/[^"#?]+\/)"/g)].map((match) => match[1]))
    .filter((href) => href !== selfHref && href !== "/blog/");
  const hasConsult = html.includes('href="/#consult"');
  const hasBlogHub = html.includes('href="/blog/"');
  const ok = Boolean(html) && relatedLinks.length >= expected && hasConsult && hasBlogHub;
  return {
    slug: post.slug,
    title: post.h1 || post.title,
    htmlPath: path.relative(root, htmlPath).replaceAll("\\", "/"),
    relatedCount: relatedLinks.length,
    expectedRelatedCount: expected,
    relatedLinks,
    hasConsult,
    hasBlogHub,
    ok,
  };
}

function buildReport(results) {
  const rows = results.map((item) =>
    `| ${item.ok ? "OK" : "CHECK"} | ${item.relatedCount}/${item.expectedRelatedCount} | ${item.hasConsult ? "Y" : "N"} | ${item.hasBlogHub ? "Y" : "N"} | ${item.slug} |`,
  ).join("\n");
  return `# 블로그 내부 링크 보강 리포트 - ${date}

## 요약
- 점검 글 수: ${results.length}
- 관련 글 목표: 글당 최대 ${minRelated}개
- 실패 글 수: ${results.filter((item) => !item.ok).length}

## 글별 상태
| 상태 | 관련 글 | 상담 링크 | 블로그 허브 | 글 |
| --- | --- | --- | --- | --- |
${rows}
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
