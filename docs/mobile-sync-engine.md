# Mobile Sync Engine

## Architecture

```
sync.store.ts                   sync-engine.ts                  op-log.ts
(Zustand store)                 (core logic)                    (write tracking)
    │                               │                               │
    ├─ engine = new SyncEngine()    │                               │
    ├─ engine.onStateChange(cb)     │                               │
    ├─ engine.lastPushAt = ...      │                               │
    ├─ engine.lastPullAt = ...      │                               │
    ├─ engine.sync() ──────────────►│                               │
    │                               ├─ pushOpLog()                  │
    │                               │   ├─ getOpLogSince() ────────►│
    │                               │   ├─ clearOpLogEntries() ────►│
    │                               ├─ pull()                       │
    │                               ├─ persistTimestamps()          │
    │                               │                               │
    │  WebSocket "sync:available"   │                               │
    ├─ engine.pull() ──────────────►│                               │
```

## Class: `SyncEngine`

Located in `apps/mobile/src/sync/sync-engine.ts`.

### Differences from Desktop

| Aspect | Desktop | Mobile |
|---|---|---|
| Event system | `EventEmitter` (Node) | Callback arrays (JS) |
| DB access | `sql: Database` param | `getSQLite()` singleton |
| Callbacks | `engine.on("state-change", cb)` | `engine.onStateChange(cb)` |
| op-log | `sync/op-log.ts` with `sql` param | `sync/op-log.ts` with singleton |

### pushOpLog flow

```
1. getOpLogSince(_lastPushAt) → entries from sync_op_log
2. Group by table: saves (parse JSON) + deletes (plain row_ids)
3. POST /api/sync/push { changes: { table: { saves, deletes } } }
4. On success:
   - clearOpLogEntries(ids)
   - _lastPushAt = now()
```

### Timestamp persistence

Uses `app_settings` table (simple key-value):
- `sync:lastPushAt` — ISO timestamp
- `sync:lastPullAt` — ISO timestamp

### `requestDeferredPush()`

Same 2-second debounce pattern as desktop.

## Services layer

All mobile CRUD services mirror Desktop IPC handlers:

| Service | File | op_log integration |
|---|---|---|
| `saveAnnotation` | `services/annotations.service.ts` | recordCompositeSave after write |
| `deleteAnnotation` | `services/annotations.service.ts` | recordCompositeDelete for all cascade |
| `saveFSRSCard` | `services/fsrs-cards.service.ts` | recordCompositeSave after write |
| `saveReviewLog` | `services/review-logs.service.ts` | recordCompositeSave after write |
| `saveAIResult` | `services/ai-results.service.ts` | recordCompositeSave after write |
| `saveSummary` | `services/summaries.service.ts` | recordSave after write |
| `saveDocument` | `services/documents.service.ts` | recordSave/recordDelete |
| `createFolder` | `services/folders.service.ts` | recordSave/recordDelete |

## File Map

| File | What |
|---|---|
| `apps/mobile/src/sync/sync-engine.ts` | Core engine (adapted from desktop) |
| `apps/mobile/src/sync/op-log.ts` | Operation log |
| `apps/mobile/src/sync/sync-client.ts` | HTTP client |
| `apps/mobile/src/sync/ws-client.ts` | WebSocket client |
| `apps/mobile/src/sync/index.ts` | `requestDeferredPush` export |
| `apps/mobile/src/stores/sync.store.ts` | Zustand store + timestamp persistence |
