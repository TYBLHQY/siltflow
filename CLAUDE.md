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

## Design docs

`docs/` contains module design reports written for AI context. Read the
relevant doc before modifying a subsystem — they record design rationale,
pitfalls, and cross-module interaction that code comments don't capture.

| Doc | What it covers |
|---|---|
| [`docs/project-overview.md`](docs/project-overview.md) | Repo map, stack, build commands, shared packages |
| [`docs/sync-protocol.md`](docs/sync-protocol.md) | Push/pull protocol, conflict detection, composite PKs, tombstone lifecycle |
| [`docs/desktop-sync-engine.md`](docs/desktop-sync-engine.md) | Desktop SyncEngine class, IPC glue, `requestDeferredPush`, timestamp persistence |
| [`docs/mobile-sync-engine.md`](docs/mobile-sync-engine.md) | Mobile SyncEngine, Zustand store, differences from desktop |
| [`docs/desktop-ipc.md`](docs/desktop-ipc.md) | IPC handler inventory, better-sqlite3 patterns, conventions |
| [`docs/sync-auth.md`](docs/sync-auth.md) | Two-tier token auth (server token → device token), registration flow |
| [`docs/changelog.md`](docs/changelog.md) | Deletion tracking, row_id encoding, known bugs (review_log ordering) |
| [`docs/database-schema.md`](docs/database-schema.md) | All tables, relationships, COALESCE rules, ORM vs raw SQL split |
| [`docs/known-bugs.md`](docs/known-bugs.md) | Fixed bugs (with root cause) + remaining issues + pre-deployment checklist |
