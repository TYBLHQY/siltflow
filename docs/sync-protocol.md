# Sync Protocol Design

## Overview

Siltflow uses a **timestamp-based incremental sync** protocol over HTTP between
client devices (desktop Electron, mobile Expo) and the sync server (Hono +
better-sqlite3).

Real-time notifications use WebSocket for "sync:available" pings (not data).

## Core Concepts

### Entities (`ENTITY_TABLES`)

7 tables are synced, defined in `packages/shared-lib/src/sync-types.ts`:

| Table | PK type | Timestamp columns |
|---|---|---|
| `documents` | simple (`id`) | `created_at`, `updated_at` |
| `folders` | simple (`id`) | `created_at`, `updated_at` |
| `annotations` | composite (`id` + `document_id`) | `created_at`, `updated_at` |
| `ai_results` | composite (`annotation_id` + `document_id`) | `created_at`, `updated_at` |
| `fsrs_cards` | composite (`annotation_id` + `document_id`) | `created_at`, `updated_at` |
| `summaries` | simple (`document_id`) | `created_at`, `updated_at` |
| `review_logs` | composite (`id` + `annotation_id` + `document_id`) | `created_at` only (no `updated_at`) |

**Key fact**: `review_logs` is append-only — it has no `updated_at` column.
All timestamp logic special-cases it.

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
**If you add a table with a composite PK, you must update this mapping on all
three sides** (server, desktop engine, mobile engine).

## Push Flow

```
Client                              Server
  │                                    │
  │ POST /api/sync/push                │
  │  body: {                           │
  │    lastSyncAt: "ISO timestamp",    │
  │    changes: {                      │
  │      annotations: {                │
  │        created: [...camelCase],    │
  │        updated: [...camelCase],    │
  │        deleted: ["id|docId", ...]  │
  │      },                            │
  │      ...                            │
  │    }                               │
  │  }                                 │
  │ ───────────────────────────────►   │
  │                                    │
  │                          1. DELETE deleted rows (record tombstones)
  │                          2. INSERT OR REPLACE created rows
  │                          3. checkConflict → UPDATE updated rows
  │                          4. WS broadcast "sync:available" to other devices
  │                                    │
  │  ◄───────────────────────────────  │
  │      { accepted: N, conflicts: [] }
```

### Server-side handling: created vs updated

This is **critical** to understand:

| Row type | Server action | Conflict detection? |
|---|---|---|
| `created` | `INSERT OR REPLACE` | **No** — silently overwrites |
| `updated` | `checkConflict` → `UPDATE` | **Yes** — compares `updated_at` |

**Implication**: If a client incorrectly classifies an update as "created",
the server will `INSERT OR REPLACE` without checking conflicts. This was the
root cause of the data corruption bug (see [[known-bugs]]).

### Conflict detection (`checkConflict`)

Only runs for `updated` rows. Compares `updated_at`:
- If server's `updated_at > client's updated_at`: conflict (server wins)
- Otherwise: apply the update

Conflicts are stored in `sync_conflicts` table on the client. Server just
reports them.

## Pull Flow

```
Client                              Server
  │                                    │
  │ POST /api/sync/pull                │
  │  body: { lastSyncAt: "ISO" }       │
  │ ───────────────────────────────►   │
  │                                    │
  │                          1. SELECT * FROM each table
  │                             WHERE updated_at > lastSyncAt
  │                             (or created_at > lastSyncAt for review_logs)
  │                          2. SELECT tombstones WHERE deleted_at > lastSyncAt
  │                          3. Record tombstone acks for this device
  │                          4. Clean fully-acked tombstones
  │                                    │
  │  ◄───────────────────────────────  │
  │      {                             │
  │        serverTime: "ISO",          │
  │        changes: {                  │
  │          annotations: [{snake_case}],
  │          ...                        │
  │        },                          │
  │        tombstones: [               │
  │          { table_name, row_id,     │
  │            deleted_at }            │
  │        ]                           │
  │      }                             │
  │                                    │
  │ Client:                            │
  │  1. upsertRemoteRow for each row   │
  │     (INSERT OR REPLACE into local) │
  │  2. applyTombstone for each        │
  │     (DELETE local row)             │
  │  3. Set lastPullAt = serverTime    │
```

### Key design decisions

1. **Server returns snake_case keys** (raw SQL column names). The client
   `upsertRemoteRow` uses them directly — no conversion. Push sends camelCase
   (client converts via `camelKeys`). This asymmetry works because pull data
   never goes through camelCase conversion.

2. **`lastPullAt` = `serverTime`**, not `Date.now()`. The server's clock is
   authoritative. If you use client time, clock skew causes missed rows.

3. **Tombstone cleanup**: Tombstones are deleted only when ALL registered
   devices have acked them OR after `tombstoneRetentionDays` (configurable,
   default 7 days).

## WebSocket Notifications

After a successful push, the server broadcasts:
```json
{
  "type": "sync:available",
  "changedBy": "<deviceId>",
  "timestamp": "<ISO>",
  "accepted": 3,
  "conflictCount": 0
}
```

Other devices receive this and trigger a **pull only** (not a full sync).
This is why `pull()` has its own `_pullInProgress` guard — it can be called
independently from `sync()`.

## Timestamp Persistence

Both clients MUST persist `lastPushAt` and `lastPullAt` across restarts:

- **Desktop**: `{vaultPath}/.siltflow/config.json` → keys `syncLastPushAt`, `syncLastPullAt`
- **Mobile**: `app_settings` table → keys `sync:lastPushAt`, `sync:lastPullAt`

If these are lost (null), the client sends `since: 1970-01-01T00:00:00Z`,
classifying ALL rows as "created" → epoch sync → server `INSERT OR REPLACE`
overwrites everything without conflict detection.

See [[known-bugs]] for the epoch-sync data corruption this caused.

## File Map

| File | What |
|---|---|
| `packages/shared-lib/src/sync-types.ts` | Protocol types (shared) |
| `apps/sync-server/src/routes/sync.ts` | Server push/pull handlers |
| `apps/desktop/electron/sync/sync-engine.ts` | Desktop engine |
| `apps/desktop/electron/ipc/sync.ipc.ts` | Desktop IPC glue |
| `apps/mobile/src/sync/sync-engine.ts` | Mobile engine |
| `apps/mobile/src/sync/sync-client.ts` | Mobile HTTP client |
| `apps/mobile/src/sync/ws-client.ts` | Mobile WebSocket client |
