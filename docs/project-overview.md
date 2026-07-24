# Project Overview

## Repository structure

```
siltflow/
├── apps/
│   ├── desktop/          Electron + Vite + React
│   │   ├── electron/     Main process (Node.js)
│   │   │   ├── ipc/      IPC handlers (CRUD + sync)
│   │   │   ├── sync/     Sync engine, client, WS, changelog
│   │   │   ├── main.ts   App entry point
│   │   │   └── database.ts  SQLite init
│   │   └── src/          Renderer process (React)
│   ├── sync-server/      Hono + better-sqlite3
│   │   └── src/
│   │       ├── routes/   API endpoints (sync, auth, entities)
│   │       ├── auth/     Auth middleware
│   │       ├── db/       Drizzle schema + migrations
│   │       └── ws/       WebSocket hub
│   └── mobile/           Expo / React Native
│       └── src/
│           ├── sync/     Sync engine, client, WS, changelog
│           ├── services/ CRUD service modules
│           ├── stores/   Zustand stores
│           └── screens/  UI screens
├── packages/
│   ├── shared-db/        SqlExecutor interface, Drizzle schema, migrations
│   └── shared-lib/       Pure logic: FSRS, stats, AI, sync types, annotation helpers
├── docs/                 Design documents (this directory)
│   ├── project-overview.md
│   ├── sync-protocol.md
│   ├── desktop-sync-engine.md
│   ├── desktop-ipc.md
│   ├── mobile-sync-engine.md
│   ├── sync-auth.md
│   ├── changelog.md
│   ├── database-schema.md
│   └── known-bugs.md
├── scripts/              Build/dev scripts
└── CLAUDE.md             Project index + conventions
```

## Technology stack

| Component | Technology |
|---|---|
| Desktop framework | Electron 33 |
| Desktop bundler | Vite + Rolldown |
| Desktop UI | React 18 |
| Desktop DB | better-sqlite3 |
| Mobile framework | Expo SDK 52 / React Native |
| Mobile ORM | Drizzle ORM (expo-sqlite driver) |
| Mobile DB | expo-sqlite |
| Sync server | Hono 4 (Node.js) |
| Server DB | better-sqlite3 (Drizzle for auth/config, raw SQL for sync) |
| Language | TypeScript 5.3+ |
| Package manager | pnpm 10.x (workspace monorepo) |

## Key design decisions

1. **Raw SQL for entity CRUD on composite-PK tables**. Drizzle ORM doesn't
   handle `INSERT OR REPLACE` with COALESCE well. Annotations, ai_results,
   fsrs_cards, and review_logs use raw SQL everywhere.

2. **Drizzle ORM for simple tables**. Documents and folders use Drizzle —
   simple CRUD, no composite PKs, no COALESCE needed.

3. **Timestamp-based sync** (not CRDT, not vector clocks). Simple and sufficient
   for single-user-per-device. The server is authoritative on ordering.

4. **WebSocket for notifications only, not data**. WS tells other devices "pull
   now". Data transfer is always HTTP.

5. **Two-tier auth**: server token (registration) + device token (operations).
   See [[sync-auth]].

6. **better-sqlite3 isolation script**: `scripts/isolate-better-sqlite3.sh`
   breaks pnpm's shared symlink so Electron's native module rebuild doesn't
   conflict with the server's. Runs as root `postinstall`.

## Build & Run

```bash
pnpm install                    # install all workspace deps
cd apps/desktop && pnpm dev     # desktop dev mode
cd apps/sync-server && pnpm dev # server dev mode
cd apps/mobile && pnpm start    # expo dev mode
```

## Database path conventions

| App | Database location |
|---|---|
| Desktop | `{vaultPath}/.siltflow/siltflow.db` |
| Mobile | `FileSystem.documentDirectory + "SQLite/siltflow.db"` |
| Server | `{cwd}/data/siltflow-sync.db` |

Desktop uses `better-sqlite3` directly (Node native addon). Mobile uses
`expo-sqlite` (JSI bridge to platform SQLite). The sync engine adapts to
both via the shared sync-engine.ts pattern.

## Shared packages

### `@siltflow/shared-lib`

Pure logic, no database dependency. Used by ALL three apps.
Contains: sync types, FSRS utilities, statistics computation, annotation
helpers, languages, providers, AI chat completion, translation.

### `@siltflow/shared-db`

Database-related shared code. Used by sync server (for Drizzle schema and
SqlExecutor) and reference by apps.
Contains: Drizzle ORM schema, SqlExecutor interface, migrations, schema
version constant.

## WebSocket hub

`apps/sync-server/src/ws/index.ts` — in-memory pub/sub. When a device pushes
changes, the server broadcasts `sync:available` to all OTHER connected devices
(excluding the pushing device via `exceptDeviceId`).

## Docs index

- [[sync-protocol]] — Push/pull protocol, conflict detection, tombstone lifecycle
- [[desktop-sync-engine]] — Desktop SyncEngine class, IPC glue, lifecycle
- [[mobile-sync-engine]] — Mobile SyncEngine, Zustand store, services layer
- [[desktop-ipc]] — IPC handler inventory, patterns, conventions
- [[sync-auth]] — Two-tier token auth, registration flow
- [[changelog]] — Deletion tracking, row_id encoding, lifecycle
- [[database-schema]] — Full schema, relationships, ORM vs raw SQL
- [[known-bugs]] — Fixed bugs, remaining issues, pre-deployment checklist
