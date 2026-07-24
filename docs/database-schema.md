# Database Schema

## Tables

7 entity tables + 3 sync infrastructure tables.

### Entity tables

All entity tables have `created_at` and (except review_logs) `updated_at` as
ISO 8601 text timestamps.

```sql
documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  original_name TEXT,
  total_pages INTEGER,
  metadata TEXT,           -- JSON blob
  folder_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,           -- self-referential FK
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

annotations (
  id TEXT NOT NULL,         -- UUID
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  type TEXT NOT NULL,       -- 'highlight' | 'annotation'
  text TEXT,
  page_number INTEGER,
  embed_data TEXT NOT NULL, -- JSON: {rects, image, text, pageIndex}
  kind TEXT NOT NULL DEFAULT 'annotation',  -- annotation kind (meaning, grammar, etc.)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (id, document_id)
)

ai_results (
  annotation_id TEXT NOT NULL,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  data TEXT NOT NULL,       -- JSON: AI response payload
  version INTEGER NOT NULL,-- AI data format version
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (annotation_id, document_id)
)

fsrs_cards (
  annotation_id TEXT NOT NULL,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  data TEXT NOT NULL,       -- JSON: {due, stability, difficulty, reps, state, ...}
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (annotation_id, document_id)
)

summaries (
  document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_ai_generated INTEGER NOT NULL DEFAULT 0,
  source_lang TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

review_logs (
  id TEXT NOT NULL,         -- UUID
  annotation_id TEXT NOT NULL,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  data TEXT NOT NULL,       -- JSON: {grade, log: {rating, state, due, ...}, card: {...}}
  created_at TEXT NOT NULL, -- NO updated_at — append-only table
  PRIMARY KEY (id, annotation_id, document_id)
)
```

### Sync infrastructure tables

**`sync_changelog`** — records local deletions (see [[changelog]]):
```sql
CREATE TABLE sync_changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,       -- pipe-delimited for composite PK tables
  action TEXT NOT NULL DEFAULT 'delete',
  created_at TEXT NOT NULL
);
```

**`sync_conflicts`** — stores unresolved push conflicts (client-side only):
```sql
CREATE TABLE sync_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  local_data TEXT,            -- JSON snapshot of local row
  remote_data TEXT NOT NULL,  -- JSON of server's version
  server_updated_at TEXT NOT NULL,
  client_updated_at TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
```

**`sync_tombstones`** and **`sync_tombstone_acks`** — server-side only, tracks
deleted rows so other devices learn about deletions on pull (see [[sync-protocol]]).

## Schema version

`SCHEMA_VERSION` is defined in `packages/shared-db/src/types.ts`. When you add
or modify a table, you must:
1. Bump `SCHEMA_VERSION`
2. Add a migration function in `packages/shared-db/src/migrations.ts`

## Key Relationships

```
documents ──1:N── annotations ──1:1── ai_results
                    │                   (annotation_id, document_id)
                    │
                    ├──1:1── fsrs_cards
                    │        (annotation_id, document_id)
                    │
                    └──1:N── review_logs
                             (id, annotation_id, document_id)

documents ──1:1── summaries (document_id)
documents ──N:1── folders (folder_id)
folders ──N:1── folders (parent_id)
```

## ORM vs raw SQL

- **Drizzle ORM** is used for `documents` and `folders` (simple CRUD, defined
  in `packages/shared-db/src/schema.ts`)
- **Raw SQL** is used for `annotations`, `ai_results`, `fsrs_cards`, `summaries`,
  and `review_logs` (composite PKs, `INSERT OR REPLACE` with COALESCE, multi-table
  transactions)

The Drizzle schema (`packages/shared-db/src/schema.ts`) is imported by the sync
server for auth queries (`devices` table). The entity table definitions are
redundant with the raw SQL in IPC handlers — **they exist in schema.ts for
documentation and type generation but the IPC handlers do NOT use them.**

**Desktop**: IPC handlers use `better-sqlite3` (`.prepare()`, `.run()`, `.get()`).
**Mobile**: Service modules use `expo-sqlite` synchronous API (`getAllSync()`,
`runSync()`, `getFirstSync()`).
**Server**: Uses Drizzle for config/auth queries, raw `better-sqlite3` for sync
operations.

## Timestamp semantics

- `created_at`: NEVER changes after first creation. Must use COALESCE in
  `INSERT OR REPLACE` to preserve the original value. See [[known-bugs]] for
  what happens when this rule is violated.

- `updated_at`: Updated to `now` on every write. Used for change detection
  (`updated_at > lastPushAt AND created_at <= lastPushAt` → "updated").

- `review_logs` has ONLY `created_at`. It's an append-only log. The push
  engine uses `created_at` for both "created" detection and as the comparable
  column in pull queries.

## File Map

| File | What |
|---|---|
| `packages/shared-db/src/schema.ts` | Drizzle ORM schema |
| `packages/shared-db/src/types.ts` | `SCHEMA_VERSION`, shared types |
| `packages/shared-db/src/migrations.ts` | Migration functions |
| `packages/shared-db/src/db.ts` | `SqlExecutor` interface |
