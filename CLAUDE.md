# Siltflow

pnpm workspace monorepo — language-learning desktop app (Electron), sync server (Hono), and mobile app (Expo).

## Structure

| Directory | Package | Runtime |
|---|---|---|
| `apps/desktop` | Electron + Vite + React | Electron (Node ABI) |
| `apps/sync-server` | Hono + better-sqlite3 | Node.js (system ABI) |
| `apps/mobile` | Expo / React Native | expo-sqlite |
| `packages/shared-db` | SqlExecutor interface, migrations, types | — |
| `packages/shared-lib` | Pure logic (no DB) | — |

## Key conventions

- Use `pnpm` — not npm or yarn.
- `SqlExecutor` in `packages/shared-db/src/db.ts` is the platform-agnostic DB interface; every app implements it with its own adapter (`better-sqlite3`, `expo-sqlite`).
- Schema version lives in `packages/shared-db/src/types.ts` (`SCHEMA_VERSION`); bump it when adding migrations.

## better-sqlite3 isolation

`scripts/isolate-better-sqlite3.sh` runs as a root `postinstall` hook, breaking pnpm's shared symlink into separate real directories so that `electron-rebuild` (desktop) and `pnpm rebuild` (sync-server) each get their own `.node` binary without overwriting each other.
