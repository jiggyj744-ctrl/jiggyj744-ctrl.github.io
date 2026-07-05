#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/jiggyj744-ctrl/jiggyj744-ctrl.github.io.git}"
TARGET_DIR="${TARGET_DIR:-/srv/nvme/services/jiggyj744-ctrl.github.io}"
SERVICE_NAME="${SERVICE_NAME:-jauction-share-blog-publisher}"
ENV_FILE="${ENV_FILE:-/etc/jauction-share-blog-publisher.env}"
TARGET_PARENT="$(dirname "$TARGET_DIR")"
MOUNT_CHECK_PATH="$TARGET_DIR"

mkdir -p "$TARGET_PARENT"
if [ ! -e "$MOUNT_CHECK_PATH" ]; then
  MOUNT_CHECK_PATH="$TARGET_PARENT"
fi

if ! findmnt -T "$MOUNT_CHECK_PATH" | grep -q "nvme-runtime/services"; then
  echo "target is not on nvme-runtime/services: $TARGET_DIR" >&2
  findmnt -T "$MOUNT_CHECK_PATH" || true
  exit 1
fi

if ! command -v git >/dev/null; then
  echo "git is required on the runtime host" >&2
  exit 1
fi

if ! command -v node >/dev/null; then
  echo "node is required on the runtime host" >&2
  echo "Install Node.js 22 or another runtime with global fetch support, then re-run this script." >&2
  exit 1
fi

if [ -d "$TARGET_DIR/.git" ]; then
  git -C "$TARGET_DIR" fetch origin main
  git -C "$TARGET_DIR" checkout main
  git -C "$TARGET_DIR" pull --ff-only origin main
else
  git clone "$REPO_URL" "$TARGET_DIR"
fi

mkdir -p "$TARGET_DIR/.runtime/logs"
chmod +x "$TARGET_DIR/ops/vm109-share-blog-publisher.sh"
install -m 0644 "$TARGET_DIR/ops/systemd/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service"
install -m 0644 "$TARGET_DIR/ops/systemd/${SERVICE_NAME}.timer" "/etc/systemd/system/${SERVICE_NAME}.timer"

if [ ! -f "$ENV_FILE" ]; then
  install -m 0600 "$TARGET_DIR/ops/jauction-share-blog-publisher.env.example" "$ENV_FILE"
  echo "created $ENV_FILE; fill LLM_PROXY_API_KEY and Git push credentials before expecting proxy generation"
fi

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.timer"
systemctl list-timers --all "${SERVICE_NAME}.timer" --no-pager
systemctl status "${SERVICE_NAME}.timer" --no-pager

echo "installed ${SERVICE_NAME} on $TARGET_DIR"
