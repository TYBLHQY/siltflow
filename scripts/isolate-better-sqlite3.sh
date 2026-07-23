#!/usr/bin/env bash
# ── isolate-better-sqlite3.sh ─────────────────────────────────────────
# better-sqlite3 is a native C++ addon. pnpm deduplicates same-version
# copies into one virtual-store path shared via symlinks + hardlinks, so
# electron-rebuild (Electron ABI) and pnpm rebuild (system Node ABI) would
# overwrite each other's .node binary.
#
# This script:
#   1. Replaces pnpm symlinks with independent real-directory copies.
#   2. Rebuilds each copy for its own runtime ABI.
#
# Run as the workspace root postinstall hook — it replaces desktop's
# own electron-rebuild postinstall.
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Step 1: break symlinks into independent copies ───────────────────
for proj in apps/desktop apps/sync-server; do
  MODULE="$ROOT/$proj/node_modules/better-sqlite3"
  if [ ! -e "$MODULE" ]; then
    echo "[isolate] $proj: better-sqlite3 not installed, skipping"
    continue
  fi

  if [ -L "$MODULE" ]; then
    TARGET="$(readlink -f "$MODULE")"
    rm "$MODULE"
    cp -rL "$TARGET" "$MODULE"
    echo "[isolate] $proj: symlink → real directory"
  else
    echo "[isolate] $proj: already a real directory, skipping copy"
  fi
done

# ── Step 2: rebuild — desktop → Electron ABI ─────────────────────────
echo "[isolate] rebuilding desktop for Electron ABI …"
# Run from the isolated directory directly so electron-rebuild only sees
# this single copy (not the sync-server copy or the virtual store).
(cd "$ROOT/apps/desktop/node_modules/better-sqlite3" && \
  npx -y @electron/rebuild -f --only better-sqlite3 2>&1 | sed 's/^/[isolate:desktop] /')
echo "[isolate] desktop: Electron ABI rebuild complete"

# ── Step 3: rebuild — sync-server → system Node ABI ──────────────────
echo "[isolate] rebuilding sync-server for system Node ABI …"
# node-gyp rebuild directly inside the module — fastest, no dependency scanning.
(cd "$ROOT/apps/sync-server/node_modules/better-sqlite3" && \
  npx -y node-gyp rebuild 2>&1 | sed 's/^/[isolate:sync-server] /')
echo "[isolate] sync-server: system Node ABI rebuild complete"

echo "[isolate] done"
