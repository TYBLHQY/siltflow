# Sync Protocol Design

## Overview

Siltflow uses an **operation-log-based sync** protocol over HTTP between
client devices (desktop Electron, mobile Expo) and the sync server (Hono +
better-sqlite3).

**Design**: single-user mirror model. Every client write is recorded in a
local `sync_op_log` table. Push reads the log and sends full row data. The
server unconditionally accepts everything with `INSERT OR REPLACE` + `DELETE`.

Real-time notifications use WebSocket for "sync:available" pings (not data).

## Why op_log instead of timestamp-based detection

The old approach classified rows as "created" vs "updated" by comparing
timestamps. This was fundamentally flawed:

- Epoch sync (timestamps lost) → all rows classified as "created"
- COALESCE bugs → updates misclassified as "created"
- Server treated "created" rows differently (blind `INSERT OR REPLACE`)

op_log eliminates classification entirely. The client records what happened;
the server applies it. No guessing. No conflict detection (single-user system).

## Core Concepts

### Entities (`ENTITY_TABLES`)

7 tables are synced, defined in `packages/shared-lib/src/sync-types.ts`:

| Table | PK type |
|---|---|
| `documents` | simple (`id`) |
| `folders` | simple (`id`) |
| `annotations` | composite (`id` + `document_id`) |
| `ai_results` | composite (`annotation_id` + `document_id`) |
| `fsrs_cards` | composite (`annotation_id` + `document_id`) |
| `summaries` | simple (`document_id`) |
| `review_logs` | composite (`id` + `annotation_id` + `document_id`) |

### Composite Primary Keys

Tables with composite PKs encode their identity as pipe-delimited strings on
the wire:
```
annotations  →  "id|document_id"
ai_results   →  "annotation_id|document_id"
fsrs_cards   →  "annotation_id|document_id"
review_logs  →  "id|annotation_id|document_id"
```

Both client and server maintain the same `COMPOSITE_PK_TABLES` mapping.

### sync_op_log (client-side)

```sql
CREATE TABLE sync_op_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,       -- pipe-delimited for composite PK
  action TEXT NOT NULL,       -- 'save' | 'delete'
  row_data TEXT,              -- full row JSON (null for delete)
  created_at TEXT NOT NULL
);
```

Every CRUD handler records an entry after mutation. `save` stores the full
row (read back from DB after write). `delete` stores only the row_id.

## Push Flow

```
Client                                      Server
  │                                            │
  │ 1. Read sync_op_log WHERE created_at > lastPushAt
  │ 2. Group by table → {saves: [...], deletes: [...]}
  │                                            │
  │ POST /api/sync/push                        │
  │  body: {                                   │
  │    lastSyncAt: "ISO",                      │
  │    changes: {                              │
  │      annotations: {                        │
  │        saves: [{id, document_id, ...}],    │
  │        deletes: ["id|docId"]               │
  │      }                                     │
  │    }                                       │
  │  }                                         │
  │ ────────────────────────────────────►      │
  │                                            │
  │                                  1. DELETE deletes + tombstones
  │                                  2. INSERT OR REPLACE saves
  │                                  3. WS broadcast "sync:available"
  │                                            │
  │  ◄────────────────────────────────────     │
  │      { accepted: N }                       │
  │                                            │
  │ 3. DELETE FROM sync_op_log WHERE id IN (...)
  │ 4. lastPushAt = now()
```

**Key property**: all saves are `INSERT OR REPLACE` — no conflict detection.
The server is a database mirror for a single user. The last writer always wins.

## Pull Flow (unchanged)

```
Client                                      Server
  │                                            │
  │ POST /api/sync/pull                        │
  │  body: { lastSyncAt: "ISO" }               │
  │ ────────────────────────────────────►      │
  │                                            │
  │                                  1. SELECT * FROM each table
  │                                     WHERE updated_at > lastSyncAt
  │                                  2. SELECT tombstones
  │                                  3. Record ack, clean tombstones
  │                                            │
  │  ◄────────────────────────────────────     │
  │      { serverTime, changes, tombstones }   │
  │                                            │
  │ 1. upsertRemoteRow for each row
  │    (INSERT OR REPLACE into local DB)
  │ 2. applyTombstone for each
  │ 3. lastPullAt = serverTime
```

## WebSocket Notifications

After a successful push, the server broadcasts:
```json
{ "type": "sync:available", "changedBy": "<deviceId>", "timestamp": "<ISO>", "accepted": 3 }
```

Other devices receive this and trigger a **pull only**.

## Timestamp Persistence

Both clients MUST persist `lastPushAt` and `lastPullAt` across restarts:

- **Desktop**: `{vaultPath}/.siltflow/config.json` → keys `syncLastPushAt`, `syncLastPullAt`
- **Mobile**: `app_settings` table → keys `sync:lastPushAt`, `sync:lastPullAt`

With op_log, losing `lastPushAt` just means re-pushing all entries (idempotent).
This is safe — no more epoch-sync data corruption.

## File Map

| File | What |
|---|---|
| `packages/shared-lib/src/sync-types.ts` | Protocol types (shared) |
| `apps/sync-server/src/routes/sync.ts` | Server push/pull handlers |
| `apps/desktop/electron/sync/sync-engine.ts` | Desktop engine |
| `apps/desktop/electron/sync/op-log.ts` | Desktop op-log |
| `apps/desktop/electron/ipc/sync.ipc.ts` | Desktop IPC glue |
| `apps/mobile/src/sync/sync-engine.ts` | Mobile engine |
| `apps/mobile/src/sync/op-log.ts` | Mobile op-log |
| `apps/mobile/src/sync/sync-client.ts` | Mobile HTTP client |
| `apps/mobile/src/sync/ws-client.ts` | Mobile WebSocket client |
