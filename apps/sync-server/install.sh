#!/usr/bin/env bash
#
# install.sh — install Siltflow sync server as a systemd service
#
# Fetches the latest server-v* release from GitHub, installs system
# dependencies, creates a dedicated user, and registers the service.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/TYBLHQY/siltflow/master/apps/sync-server/install.sh | sudo bash
#   # or:
#   sudo bash install.sh
#
# Environment overrides:
#   PORT=3001                  HTTP port
#   DATA_DIR=/var/lib/siltflow-server
#   SERVER_TOKEN=...           skip auto-generate, use this token
#   SiltFlow_FORCE_DOWNLOAD=1  re-download even if server.cjs exists
#

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────

GITHUB_OWNER="TYBLHQY"
GITHUB_REPO="siltflow"
RELEASES_API="https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=10"

SILTFLOW_USER="siltflow"
INSTALL_DIR="/opt/siltflow-server"
DATA_DIR="${DATA_DIR:-/var/lib/siltflow-server}"
PORT="${PORT:-3001}"
FORCE_DOWNLOAD="${SILTFLOW_FORCE_DOWNLOAD:-0}"
SERVICE_NAME="siltflow-server"
NODE_BIN="${NODE_BIN:-/usr/bin/node}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[siltflow]${NC} $*"; }
warn() { echo -e "${YELLOW}[siltflow]${NC} $*"; }
err()  { echo -e "${RED}[siltflow]${NC} $*" >&2; }

# ── Preflight ───────────────────────────────────────────────────────────────

if [ "$(id -u)" -ne 0 ]; then
  err "This script must be run as root (or via sudo)."
  exit 1
fi

# ── Dependencies ────────────────────────────────────────────────────────────

log "Checking system dependencies…"

# Node.js
if ! command -v node &>/dev/null; then
  err "Node.js is not installed. Install Node 24+ first: https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  warn "Node $(node -v) detected. Node 22+ recommended. Continuing anyway…"
fi

# better-sqlite3 (global, needed by server.cjs at runtime)
if ! node -e "require('better-sqlite3')" &>/dev/null; then
  log "Installing better-sqlite3 globally…"
  npm install -g better-sqlite3@12
fi

# edge-tts (Python CLI, used for TTS proxy)
if ! command -v edge-tts &>/dev/null; then
  log "Installing edge-tts…"
  if command -v pip3 &>/dev/null; then
    pip3 install --break-system-packages edge-tts
  elif command -v pip &>/dev/null; then
    pip install --break-system-packages edge-tts
  else
    err "pip3 not found. Install Python 3 and pip, then re-run."
    exit 1
  fi
fi

# ── User / directories ──────────────────────────────────────────────────────

if ! id -u "$SILTFLOW_USER" &>/dev/null; then
  log "Creating system user '$SILTFLOW_USER'…"
  useradd -r -s /usr/sbin/nologin "$SILTFLOW_USER"
fi

mkdir -p "$INSTALL_DIR" "$DATA_DIR"
chown "$SILTFLOW_USER:$SILTFLOW_USER" "$INSTALL_DIR" "$DATA_DIR"
chmod 750 "$INSTALL_DIR" "$DATA_DIR"

# ── Resolve server token ────────────────────────────────────────────────────

if [ -n "${SERVER_TOKEN:-}" ]; then
  log "Using SERVER_TOKEN from environment."
else
  # Try existing token file, otherwise generate
  TOKEN_FILE="$DATA_DIR/server-token"
  if [ -f "$TOKEN_FILE" ]; then
    SERVER_TOKEN=$(cat "$TOKEN_FILE")
    log "Reusing existing server token from $TOKEN_FILE."
  else
    SERVER_TOKEN=$(openssl rand -hex 32)
    echo "$SERVER_TOKEN" > "$TOKEN_FILE"
    chown "$SILTFLOW_USER:$SILTFLOW_USER" "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"
    log "Generated new server token → $TOKEN_FILE"
  fi
fi

# ── Download latest server.cjs ──────────────────────────────────────────────

CJS_PATH="$INSTALL_DIR/server.cjs"

if [ -f "$CJS_PATH" ] && [ "$FORCE_DOWNLOAD" != "1" ]; then
  log "server.cjs already exists at $CJS_PATH.  (Set SILTFLOW_FORCE_DOWNLOAD=1 to replace.)"
else
  log "Finding latest server release on GitHub…"

  RELEASES_JSON=$(curl -fsSL "$RELEASES_API" || true)
  if [ -z "$RELEASES_JSON" ]; then
    err "Failed to fetch releases from GitHub API."
    exit 1
  fi

  # Find first server-v* release that has a server.cjs asset
  DOWNLOAD_URL=$(echo "$RELEASES_JSON" | node -e "
    const data = '';
    process.stdin.on('data', c => data += c);
    process.stdin.on('end', () => {
      const releases = JSON.parse(data);
      for (const r of releases) {
        if (!r.tag_name.startsWith('server-v')) continue;
        const cjs = r.assets.find(a => a.name === 'server.cjs');
        if (cjs) { console.log(cjs.browser_download_url); process.exit(0); }
      }
      process.exit(1);
    });
  " 2>/dev/null || true)

  if [ -z "$DOWNLOAD_URL" ]; then
    err "No server-v* release with server.cjs found."
    exit 1
  fi

  log "Downloading server.cjs → $CJS_PATH"
  log "  URL: $DOWNLOAD_URL"

  curl -fsSL "$DOWNLOAD_URL" -o "$CJS_PATH.download"
  chown "$SILTFLOW_USER:$SILTFLOW_USER" "$CJS_PATH.download"
  chmod 750 "$CJS_PATH.download"
  mv "$CJS_PATH.download" "$CJS_PATH"

  log "Download complete."
fi

# ── Server version (for health endpoint) ────────────────────────────────────

TAG_JSON=$(curl -fsSL "$RELEASES_API" || true)
SERVER_VERSION=$(echo "$TAG_JSON" | node -e "
  const data = '';
  process.stdin.on('data', c => data += c);
  process.stdin.on('end', () => {
    const releases = JSON.parse(data);
    for (const r of releases) {
      if (r.tag_name.startsWith('server-v')) {
        console.log(r.tag_name.replace('server-v', ''));
        process.exit(0);
      }
    }
    process.exit(1);
  });
" 2>/dev/null || echo "unknown")

# ── systemd unit ────────────────────────────────────────────────────────────

SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [ -f "$SERVICE_FILE" ]; then
  log "systemd unit already exists — stopping before overwriting."
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
fi

log "Writing systemd unit → $SERVICE_FILE"

cat > "$SERVICE_FILE" << UNIT
[Unit]
Description=Siltflow Sync Server
Documentation=https://github.com/TYBLHQY/siltflow
After=network.target
Wants=network.target

[Service]
Type=simple
User=$SILTFLOW_USER
Group=$SILTFLOW_USER

WorkingDirectory=$INSTALL_DIR
ExecStart=$NODE_BIN $INSTALL_DIR/server.cjs

Restart=always
RestartSec=2

NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$INSTALL_DIR $DATA_DIR
ReadOnlyPaths=$NODE_BIN

Environment=PORT=$PORT
Environment=DATA_DIR=$DATA_DIR
Environment=SERVER_TOKEN=$SERVER_TOKEN
Environment=SERVER_VERSION=$SERVER_VERSION

[Install]
WantedBy=multi-user.target
UNIT

# ── Start ───────────────────────────────────────────────────────────────────

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

# ── Done ────────────────────────────────────────────────────────────────────

echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "  Siltflow server installed!"
log ""
log "  Version:      $SERVER_VERSION"
log "  Port:         $PORT"
log "  Data dir:     $DATA_DIR"
log "  Server token: $SERVER_TOKEN"
log ""
log "  Commands:"
log "    systemctl status  $SERVICE_NAME"
log "    journalctl -u     $SERVICE_NAME -f"
log "    systemctl restart $SERVICE_NAME"
log ""
log "  Update (mobile or curl):"
log "    curl -X POST http://\$(hostname -I | awk '{print \$1}'):$PORT/api/admin/update \\"
log "      -H 'Authorization: Bearer $SERVER_TOKEN'"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
