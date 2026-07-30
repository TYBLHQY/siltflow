#!/usr/bin/env bash
#
# install.sh — install Siltflow sync server
#
# System install (default, requires root):
#   curl -fsSL https://raw.githubusercontent.com/TYBLHQY/siltflow/master/apps/sync-server/install.sh | sudo bash
#
# User install (no root needed):
#   curl -fsSL https://raw.githubusercontent.com/TYBLHQY/siltflow/master/apps/sync-server/install.sh | bash -s -- --user
#   (Or download first: bash install.sh --user)
#
# Environment overrides:
#   PORT=3001                  HTTP port
#   DATA_DIR=~/.local/share/siltflow-server
#   SERVER_TOKEN=...           skip auto-generate, use this token
#   SILTFLOW_FORCE_DOWNLOAD=1  re-download even if server.cjs exists
#

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────

GITHUB_OWNER="TYBLHQY"
GITHUB_REPO="siltflow"
RELEASE_API="https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/release"

SERVICE_NAME="siltflow-server"
NODE_BIN="${NODE_BIN:-/usr/bin/node}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[siltflow]${NC} $*"; }
warn() { echo -e "${YELLOW}[siltflow]${NC} $*"; }
err()  { echo -e "${RED}[siltflow]${NC} $*" >&2; }

# ── Mode detection ──────────────────────────────────────────────────────────

if [ "${1:-}" = "--user" ]; then
  MODE="user"
elif [ "$(id -u)" -eq 0 ]; then
  MODE="system"
else
  warn "Not running as root — auto-selecting --user mode."
  warn "For system install, re-run with: sudo bash install.sh"
  MODE="user"
fi

if [ "$MODE" = "user" ]; then
  SILTFLOW_USER="$USER"
  INSTALL_DIR="${HOME}/.local/siltflow-server"
  DATA_DIR="${DATA_DIR:-${HOME}/.local/share/siltflow-server}"
  SYSTEMD_DIR="${HOME}/.config/systemd/user"
  IS_ROOT=false
  USE_SUDO=""
else
  SILTFLOW_USER="siltflow"
  INSTALL_DIR="/opt/siltflow-server"
  DATA_DIR="${DATA_DIR:-/var/lib/siltflow-server}"
  SYSTEMD_DIR="/etc/systemd/system"
  IS_ROOT=true
  USE_SUDO="sudo -u ${SILTFLOW_USER}"
fi

PORT="${PORT:-3001}"
FORCE_DOWNLOAD="${SILTFLOW_FORCE_DOWNLOAD:-0}"

log "Install mode: ${MODE}"
log "  Install dir: ${INSTALL_DIR}"
log "  Data dir:    ${DATA_DIR}"

# ── Dependencies ────────────────────────────────────────────────────────────

log "Checking system dependencies…"

# Node.js — check PATH first, then common locations
NODE_CMD=""
for candidate in "$NODE_BIN" /usr/local/bin/node /opt/homebrew/bin/node; do
  if [ -x "$candidate" ]; then
    NODE_CMD="$candidate"
    NODE_BIN="$candidate"
    break
  fi
done
if [ -z "$NODE_CMD" ]; then
  if command -v node &>/dev/null; then
    NODE_CMD="$(command -v node)"
    NODE_BIN="$NODE_CMD"
  fi
fi

if [ -z "$NODE_CMD" ]; then
  err "Node.js is not installed."
  if [ "$MODE" = "user" ]; then
    log "Install Node.js via one of:"
    log "  curl -fsSL https://nodejs.org/dist/v24.18.0/node-v24.18.0-linux-x64.tar.xz | tar -xJC ~/.local"
    log "  export PATH=\"\$HOME/.local/node-v24.18.0-linux-x64/bin:\$PATH\""
    log "  Or use: fnm / nvm / asdf"
  else
    log "Install Node 24+ first: https://nodejs.org"
  fi
  exit 1
fi

NODE_VERSION=$("$NODE_CMD" -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  warn "Node $("$NODE_CMD" -v) detected. Node 22+ recommended. Continuing anyway…"
fi

# better-sqlite3 (must be accessible to server.cjs at runtime)
if ! "$NODE_CMD" -e "require('better-sqlite3')" &>/dev/null; then
  log "Installing better-sqlite3…"
  if [ "$MODE" = "system" ]; then
    npm install -g better-sqlite3@12
  else
    npm install --prefix "$INSTALL_DIR" better-sqlite3@12
    # Add to NODE_PATH so server.cjs finds it
    export NODE_PATH="${INSTALL_DIR}/node_modules:${NODE_PATH:-}"
  fi
fi

# edge-tts (Python CLI, used for TTS proxy)
if ! command -v edge-tts &>/dev/null; then
  log "Installing edge-tts…"
  PIP=""
  for p in pip3 pip; do
    if command -v $p &>/dev/null; then $p install --break-system-packages --user edge-tts 2>/dev/null && break; fi
  done
  if ! command -v edge-tts &>/dev/null; then
    warn "edge-tts not found — TTS proxy will not work until installed."
  fi
fi

# ── User / directories ──────────────────────────────────────────────────────

if [ "$MODE" = "system" ]; then
  if ! id -u "$SILTFLOW_USER" &>/dev/null; then
    log "Creating system user '$SILTFLOW_USER'…"
    useradd -r -s /usr/sbin/nologin "$SILTFLOW_USER"
  fi
  mkdir -p "$INSTALL_DIR" "$DATA_DIR"
  chown "$SILTFLOW_USER:$SILTFLOW_USER" "$INSTALL_DIR" "$DATA_DIR"
  chmod 750 "$INSTALL_DIR" "$DATA_DIR"
else
  mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$SYSTEMD_DIR"
fi

# ── Resolve server token ────────────────────────────────────────────────────

if [ -n "${SERVER_TOKEN:-}" ]; then
  log "Using SERVER_TOKEN from environment."
else
  TOKEN_FILE="$DATA_DIR/server-token"
  if [ -f "$TOKEN_FILE" ]; then
    SERVER_TOKEN=$(cat "$TOKEN_FILE")
    log "Reusing existing server token from $TOKEN_FILE."
  else
    SERVER_TOKEN=$(openssl rand -hex 32 || python3 -c "import secrets; print(secrets.token_hex(32))" || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "$SERVER_TOKEN" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"
    log "Generated new server token → $TOKEN_FILE"
  fi
fi

# ── Download latest server.cjs ──────────────────────────────────────────────

CJS_PATH="$INSTALL_DIR/server.cjs"

if [ -f "$CJS_PATH" ] && [ "$FORCE_DOWNLOAD" != "1" ]; then
  log "server.cjs already exists at $CJS_PATH.  (Set SILTFLOW_FORCE_DOWNLOAD=1 to replace.)"
else
  log "Finding server.cjs from unified release…"

  RELEASE_JSON=$(curl -fsSL "$RELEASE_API" || true)
  if [ -z "$RELEASE_JSON" ]; then
    err "Failed to fetch release from GitHub API."
    exit 1
  fi

  DOWNLOAD_URL=$(echo "$RELEASE_JSON" | "$NODE_CMD" -e "
    let data = '';
    process.stdin.on('data', c => data += c);
    process.stdin.on('end', () => {
      const release = JSON.parse(data);
      const cjs = release.assets.find(a => a.name === 'server.cjs');
      if (cjs) { console.log(cjs.browser_download_url); process.exit(0); }
      process.exit(1);
    });
  " 2>/dev/null || true)

  if [ -z "$DOWNLOAD_URL" ]; then
    err "No server.cjs found in the unified release."
    exit 1
  fi

  log "Downloading server.cjs → $CJS_PATH"
  log "  URL: $DOWNLOAD_URL"

  curl -fsSL "$DOWNLOAD_URL" -o "$CJS_PATH.download"
  mv "$CJS_PATH.download" "$CJS_PATH"
  chmod 750 "$CJS_PATH"

  log "Download complete."
fi

# ── Download dashboard ─────────────────────────────────────────────────────

DASHBOARD_DIR="$INSTALL_DIR/dist-dashboard"

if [ -d "$DASHBOARD_DIR" ] && [ "$FORCE_DOWNLOAD" != "1" ]; then
  log "Dashboard already exists at $DASHBOARD_DIR.  (Set SILTFLOW_FORCE_DOWNLOAD=1 to replace.)"
else
  # Fetch the release if not already done by the server.cjs block
  if [ -z "${RELEASE_JSON:-}" ]; then
    RELEASE_JSON=$(curl -fsSL "$RELEASE_API" || true)
  fi
  DASHBOARD_URL=$(echo "${RELEASE_JSON:-}" | "$NODE_CMD" -e "
    let data = '';
    process.stdin.on('data', c => data += c);
    process.stdin.on('end', () => {
      const release = JSON.parse(data);
      const d = release.assets.find(a => a.name === 'dashboard.tar.gz');
      if (d) { console.log(d.browser_download_url); process.exit(0); }
      process.exit(1);
    });
  " 2>/dev/null || true)

  if [ -n "$DASHBOARD_URL" ]; then
    log "Downloading dashboard → $DASHBOARD_DIR"
    rm -rf "$DASHBOARD_DIR"
    curl -fsSL "$DASHBOARD_URL" | tar -xz -C "$INSTALL_DIR"
    log "Dashboard extracted to $DASHBOARD_DIR"
  else
    warn "No dashboard.tar.gz found in release — dashboard will not be available."
  fi
fi

# ── Server version (from latest-server.json in the unified release) ───────────

LATEST_SERVER_JSON_URL="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/release/latest-server.json"
SERVER_VERSION=$(curl -fsSL "$LATEST_SERVER_JSON_URL" | "$NODE_CMD" -e "
  let data = '';
  process.stdin.on('data', c => data += c);
  process.stdin.on('end', () => {
    const meta = JSON.parse(data);
    console.log(meta.version || 'unknown');
  });
" 2>/dev/null || echo "unknown")

# ── systemd unit ────────────────────────────────────────────────────────────

SERVICE_FILE="$SYSTEMD_DIR/${SERVICE_NAME}.service"

if [ -f "$SERVICE_FILE" ]; then
  log "systemd unit already exists — stopping before overwriting."
  if [ "$MODE" = "system" ]; then
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  else
    systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true
  fi
fi

log "Writing systemd unit → $SERVICE_FILE"

if [ "$MODE" = "system" ]; then
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
else
  cat > "$SERVICE_FILE" << UNIT
[Unit]
Description=Siltflow Sync Server (user)
Documentation=https://github.com/TYBLHQY/siltflow
After=network.target
Wants=network.target

[Service]
Type=simple

WorkingDirectory=$INSTALL_DIR
ExecStart=$NODE_BIN $INSTALL_DIR/server.cjs

Restart=always
RestartSec=2

Environment=PORT=$PORT
Environment=DATA_DIR=$DATA_DIR
Environment=SERVER_TOKEN=$SERVER_TOKEN
Environment=SERVER_VERSION=$SERVER_VERSION
Environment=NODE_PATH=${INSTALL_DIR}/node_modules:\${NODE_PATH:-}

[Install]
WantedBy=default.target
UNIT
fi

# ── Start ───────────────────────────────────────────────────────────────────

if [ "$MODE" = "system" ]; then
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
  STATUS_CMD="systemctl status $SERVICE_NAME"
  JOURNAL_CMD="journalctl -u $SERVICE_NAME -f"
  RESTART_CMD="systemctl restart $SERVICE_NAME"
else
  systemctl --user daemon-reload
  systemctl --user enable "$SERVICE_NAME"
  systemctl --user restart "$SERVICE_NAME"
  # Enable lingering so the user service survives logout
  if [ "$IS_ROOT" = true ]; then
    loginctl enable-linger "$SILTFLOW_USER" 2>/dev/null || true
  else
    loginctl enable-linger 2>/dev/null || warn "Run 'loginctl enable-linger' to keep the service running after logout"
  fi
  STATUS_CMD="systemctl --user status $SERVICE_NAME"
  JOURNAL_CMD="journalctl --user -u $SERVICE_NAME -f"
  RESTART_CMD="systemctl --user restart $SERVICE_NAME"
fi

# ── Done ────────────────────────────────────────────────────────────────────

echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "  Siltflow server installed! (mode: ${MODE})"
log ""
log "  Version:      $SERVER_VERSION"
log "  Port:         $PORT"
log "  Data dir:     $DATA_DIR"
log "  Server token: $SERVER_TOKEN"
log ""
log "  Commands:"
log "    $STATUS_CMD"
log "    $JOURNAL_CMD"
log "    $RESTART_CMD"
log ""
log "  Update (curl):"
log "    curl -X POST http://localhost:$PORT/api/admin/update \\"
log "      -H 'Authorization: Bearer $SERVER_TOKEN'"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
