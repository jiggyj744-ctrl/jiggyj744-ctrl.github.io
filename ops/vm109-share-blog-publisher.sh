#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${JAUCTION_REPO_DIR:-/srv/jiggyj744-ctrl.github.io}"
LOCK_FILE="${JAUCTION_PUBLISH_LOCK:-/var/lock/jauction-share-blog-publisher.lock}"
LOG_DIR="${JAUCTION_PUBLISH_LOG_DIR:-/var/log/jauction-share-blog-publisher}"
LIMIT="${PUBLISH_LIMIT:-1}"
SITE_BASE="${SITE_BASE:-https://jiggyj744-ctrl.github.io}"
GENERATION_MODE="${GENERATION_MODE:-proxy}"
LLM_PROXY_BASE_URL="${LLM_PROXY_BASE_URL:-http://127.0.0.1:8302/v1}"
LLM_PROXY_MODEL="${LLM_PROXY_MODEL:-gemini-pro}"

mkdir -p "$(dirname "$LOCK_FILE")" "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "publisher already running"
  exit 0
fi

: "${LLM_PROXY_API_KEY:?LLM_PROXY_API_KEY is required}"

cd "$REPO_DIR"
export SITE_BASE GENERATION_MODE LLM_PROXY_BASE_URL LLM_PROXY_MODEL LLM_PROXY_API_KEY

git fetch origin main
git checkout main
git pull --ff-only origin main

if [ "${FORCE_PUBLISH:-0}" != "1" ]; then
  SHOULD_CONTINUE="$(node --input-type=module <<'NODE'
import fs from "node:fs";
function kstDate(value) {
  const date = value ? new Date(value) : new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const today = kstDate();
const state = fs.existsSync("ops/index-state.json")
  ? JSON.parse(fs.readFileSync("ops/index-state.json", "utf8"))
  : { runs: [] };
const alreadyPublished = (state.runs || []).some((run) =>
  kstDate(run.date) === today &&
  Array.isArray(run.pages) &&
  run.pages.some((page) => String(page).startsWith("blog/"))
);
console.error(alreadyPublished ? `blog already published for ${today}` : `blog publish allowed for ${today}`);
console.log(alreadyPublished ? "0" : "1");
NODE
)"
  if [ "$SHOULD_CONTINUE" != "1" ]; then
    exit 0
  fi
fi

node --input-type=module <<'NODE'
const baseUrl = process.env.LLM_PROXY_BASE_URL.replace(/\/$/, "");
const healthBase = baseUrl.replace(/\/v1$/, "");
const headers = {
  "Content-Type": "application/json",
  "Authorization": "Bearer " + process.env.LLM_PROXY_API_KEY
};
const health = await fetch(healthBase + "/health", { headers });
if (!health.ok) {
  console.error("Gemini proxy health failed: " + health.status + " " + await health.text());
  process.exit(1);
}
const completion = await fetch(baseUrl + "/chat/completions", {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: process.env.LLM_PROXY_MODEL,
    messages: [{ role: "user", content: "Return one short JSON object confirming the route is online." }],
    temperature: 0,
    max_tokens: 128,
    response_format: { type: "json_object" }
  })
});
if (!completion.ok) {
  console.error("Gemini proxy completion failed: " + completion.status + " " + await completion.text());
  process.exit(1);
}
const data = await completion.json();
const text = data.choices?.[0]?.message?.content || data.output_text || "";
if (!text.trim()) {
  console.error("Gemini proxy returned an empty completion");
  process.exit(1);
}
console.log("Gemini proxy completion route OK via " + process.env.LLM_PROXY_MODEL);
NODE

node scripts/seo-content-engine.mjs --limit "$LIMIT"
node tools/verify_site.mjs

if [ -n "$(git status --porcelain)" ]; then
  git config user.name "${GIT_AUTHOR_NAME:-jauction-publisher}"
  git config user.email "${GIT_AUTHOR_EMAIL:-jauction-publisher@users.noreply.github.com}"
  git add .
  git commit -m "Publish scheduled share acquisition blog"
  git push origin main
else
  echo "No generated changes"
fi

LAST_URL="$(node --input-type=module <<'NODE'
import fs from "node:fs";
const base = process.env.SITE_BASE.replace(/\/$/, "");
const state = JSON.parse(fs.readFileSync("ops/index-state.json", "utf8"));
const page = state.runs?.[0]?.pages?.[0] || "";
console.log(page ? `${base}/${page.replace(/^\/+|\/+$/g, "")}/` : "");
NODE
)"

if [ -n "$LAST_URL" ]; then
  for attempt in 1 2 3 4 5; do
    if curl -fsS --max-time 20 "$LAST_URL" >/dev/null; then
      echo "public URL OK: $LAST_URL"
      break
    fi
    sleep 15
    if [ "$attempt" = "5" ]; then
      echo "public URL check failed: $LAST_URL" >&2
      exit 1
    fi
  done
fi
