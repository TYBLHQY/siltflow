# Desktop Sync Engine

## Architecture

```
main.ts                         sync.ipc.ts                    sync-engine.ts
(app startup)                   (IPC glue)                     (core logic)
    │                               │                               │
    ├─ readVaultConfig()            │                               │
    ├─ initSyncEngine(cfg, opts)───►│                               │
    │                               ├─ new SyncEngine(client,ws,sql)│
    │                               ├─ engine.lastPushAt = ...      │
    │                               ├─ engine.lastPullAt = ...      │
    │                               ├─ engine.on("state-change",…)  │
    │                               ├─ engine.sync() ──────────────►│
    │                               │                               ├─ pushOpLog()
    │                               │                               ├─ pull()
    │                               │                               ├─ _emitState()
    │                               │  ◄── state-change event ─────┤
    │                               ├─ writeVaultConfig(timestamps) │
    │                               │                               │
    │                               │  WebSocket "sync:available"   │
    │                               ├─ engine.pull() ──────────────►│
```

## Class: `SyncEngine extends EventEmitter`

Located in `apps/desktop/electron/sync/sync-engine.ts`.

### State

```typescript
private _lastPushAt: string | null = null;
private _lastPullAt: string | null = null;
private _syncInProgress = false;     // guards sync()
private _pushInProgress = false;     // guards pushOpLog()
private _pullInProgress = false;     // guards pull()
private _lastError: string | null = null;
```

### Public API

| Method | Description | Guards |
|---|---|---|
| `sync()` | Push then pull (full cycle) | `_syncInProgress` |
| `pushOpLog()` | Read `sync_op_log`, send to server, clear sent entries | `_pushInProgress` |
| `pull()` | Fetch and apply remote changes | `_pullInProgress` |

### pushOpLog flow

```
1. SELECT * FROM sync_op_log WHERE created_at > _lastPushAt
2. Group entries by table_name:
   - 'save' entries → parse row_data JSON → add to saves[]
   - 'delete' entries → add to deletes[]
3. POST /api/sync/push { changes: { table: { saves, deletes } } }
4. On success:
   - DELETE FROM sync_op_log WHERE id IN (...pushed IDs)
   - _lastPushAt = now()
```

No more `camelKeys` conversion on push — rows are read from DB (snake_case)
and sent as-is. The server converts camelCase to snake_case on receipt, so
we send camelCase to match the server's expectation... Actually, looking at
the op_log entries: `recordSave` stores `row_data` as JSON of the raw DB
row (snake_case). When push reads it, `JSON.parse(entry.row_data)` gives
snake_case keys. The server's `snakeKeys()` converts camelCase→snake_case,
so we need to be consistent.

**Current approach**: `recordSave` stores the DB row as-is (snake_case).
The `camelKeys` helper is kept on the engine class for when rows need to be
converted. For now, rows in op_log come from DB queries (snake_case) and
the server has a `snakeKeys` converter — but the protocol says we send
camelCase. We call `camelKeys` on the row data before putting it in
`op_log.row_data`.

Wait — actually the simplest approach: store the row as-is from the DB
(snake_case), and on push, convert to camelCase before sending. The
`camelKeys` helper is still on the engine class for this purpose.

### upsertRemoteRow

Pulled rows are applied with `INSERT OR REPLACE` using the raw snake_case
keys from the server. **This means a pull always bumps `updated_at`** even
if the data didn't change — but with op_log this doesn't matter because
pull writes don't go through CRUD handlers (no op_log entry generated).

### Diagnostic log convention

All logs use `[Sync:Desktop]` prefix for easy grep filtering.

## IPC layer: `sync.ipc.ts`

### `initSyncEngine(cfg, options?)`

Called from `main.ts` at startup with persisted timestamps. Timestamps are
applied before `engine.sync()` runs.

### `requestDeferredPush()`

2-second debounced push. Called after every local write (annotation save,
FSRS card save, etc.).

### Channels

| Channel | Handler |
|---|---|
| `sync:getState` | Returns `engine.state` |
| `sync:syncNow` | `engine.sync()` |
| `sync:configure` | Saves config, re-inits engine |
| `sync:register` | Registers device with server |
| `sync:verifyToken` | Verifies token validity |
| `sync:disconnect` | Tears down engine, clears config |

Note: `sync:getConflicts` and `sync:resolveConflict` removed — no more
conflicts in the op_log design.

## File Map

| File | What |
|---|---|
| `apps/desktop/electron/sync/sync-engine.ts` | Core engine |
| `apps/desktop/electron/sync/op-log.ts` | Operation log (save/delete tracking) |
| `apps/desktop/electron/sync/sync-client.ts` | HTTP client |
| `apps/desktop/electron/sync/ws-client.ts` | WebSocket client |
| `apps/desktop/electron/ipc/sync.ipc.ts` | IPC glue + deferredPush |
| `apps/desktop/electron/main.ts` | Startup init + timestamp persistence |
