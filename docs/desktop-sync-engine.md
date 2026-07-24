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
    │                               │                               ├─ pushIncremental()
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
private _pushInProgress = false;     // guards pushIncremental()
private _pullInProgress = false;     // guards pull()
private _lastError: string | null = null;
```

Three separate progress flags are intentional — see [[known-bugs#concurrent-pull-race]].

### Public API

| Method | Description | Guards |
|---|---|---|
| `sync()` | Push then pull (full cycle) | `_syncInProgress` |
| `pushFull()` | Send ALL rows as created (epoch sync) | None |
| `pushIncremental()` | Send only rows changed since `_lastPushAt` | `_pushInProgress` |
| `pull()` | Fetch and apply remote changes | `_pullInProgress` |

### camelKeys conversion

On push, local DB columns (snake_case) are converted to camelCase for the JSON
protocol. On pull, server returns snake_case directly — no conversion needed.

```typescript
private camelKeys(row: Record<string, unknown>, _table: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = value;
  }
  return out;
}
```

### upsertRemoteRow

Pulled rows are applied with `INSERT OR REPLACE` using the raw snake_case keys
from the server. **This means a pull always bumps `updated_at`** even if the
data didn't change — potential "sync echo" issue (see [[known-bugs]]).

## IPC layer: `sync.ipc.ts`

### `initSyncEngine(cfg, options?)`

Called from `main.ts` at startup with persisted timestamps:

```typescript
initSyncEngine(syncCfg, {
  lastPushAt: vaultCfg.syncLastPushAt,
  lastPullAt: vaultCfg.syncLastPullAt,
  onStateChange: (state) => {
    // Persist timestamps on every sync completion
    writeVaultConfig(vault, { syncLastPushAt, syncLastPullAt });
  },
});
```

**Order matters**: timestamps must be applied BEFORE `engine.sync()` runs.

### `requestDeferredPush()`

2-second debounced push. Called after every local write (annotation save,
FSRS card save, etc.). Multiple rapid writes → only one push fires.

### Channels

| Channel | Handler |
|---|---|
| `sync:getState` | Returns `engine.state` |
| `sync:syncNow` | `engine.sync()` |
| `sync:configure` | Saves config, re-inits engine with new settings |
| `sync:register` | Registers device with server (uses server token) |
| `sync:verifyToken` | Verifies a token is still valid |
| `sync:getConflicts` | Returns unresolved `sync_conflicts` rows |
| `sync:resolveConflict` | Resolves a conflict (local | remote) |
| `sync:disconnect` | Tears down engine, clears config |

## Diagnostic log convention

All logs use `[Sync:Desktop]` prefix for easy grep filtering. These diagnostic
logs are still in the code (added 2026-07-24 for debugging the data corruption).
They can be removed once stability is fully confirmed.

## File Map

| File | What |
|---|---|
| `apps/desktop/electron/sync/sync-engine.ts` | Core engine |
| `apps/desktop/electron/sync/sync-client.ts` | HTTP client |
| `apps/desktop/electron/sync/ws-client.ts` | WebSocket client |
| `apps/desktop/electron/sync/changelog.ts` | Deletion tracking |
| `apps/desktop/electron/ipc/sync.ipc.ts` | IPC glue + deferredPush |
| `apps/desktop/electron/main.ts` | Startup init + timestamp persistence |
