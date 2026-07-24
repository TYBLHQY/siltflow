# Mobile Sync Engine

## Architecture

```
sync.store.ts                   sync-engine.ts                  changelog.ts
(Zustand store)                 (core logic)                    (deletion tracking)
    │                               │                               │
    ├─ engine = new SyncEngine()    │                               │
    ├─ engine.onStateChange(cb)     │                               │
    ├─ engine.lastPushAt = ...      │                               │
    ├─ engine.lastPullAt = ...      │                               │
    ├─ engine.sync() ──────────────►│                               │
    │                               ├─ pushIncremental()            │
    │                               │   ├─ getDeletionsSince() ────►│
    │                               │   ├─ clearDeletions() ───────►│
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
| DB access | `sql: Database` param in constructor | `getSQLite()` singleton |
| camelKeys | Instance method | Instance method (identical) |
| Conflict storage | `sql.prepare().run()` | `sql.runSync()` |
| Tombstone apply | Instance method | Instance method (identical) |
| `tsCol` helper | Module-level function | Module-level function (identical) |

### State callbacks

```typescript
private _onStateChange: StateChangeCallback[] = [];
private _onError: ErrorCallback[] = [];
private _onConflicts: ConflictsCallback[] = [];

onStateChange(cb: StateChangeCallback): void { this._onStateChange.push(cb); }
onError(cb: ErrorCallback): void { this._onError.push(cb); }
onConflicts(cb: ConflictsCallback): void { this._onConflicts.push(cb); }
```

Desktop uses EventEmitter (`engine.on("state-change", cb)`) — mobile uses
callback arrays. They achieve the same thing via different patterns.

### The sync.store.ts integration

`apps/mobile/src/stores/sync.store.ts` is a Zustand store that wraps the engine:

```typescript
// On startup:
const engine = new SyncEngine(client, ws)
engine.lastPushAt = await getSetting("sync:lastPushAt")
engine.lastPullAt = await getSetting("sync:lastPullAt")
engine.onStateChange((state) => {
  // Update Zustand state for UI
  set({ lastPushAt: state.lastPushAt, ... })
  // Persist timestamps
  if (state.lastPushAt) setSetting("sync:lastPushAt", state.lastPushAt)
  if (state.lastPullAt) setSetting("sync:lastPullAt", state.lastPullAt)
})
```

### Timestamp persistence

Uses `app_settings` table (simple key-value):
```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Keys:
- `sync:lastPushAt` — ISO timestamp
- `sync:lastPullAt` — ISO timestamp
- `sync:deviceId` — device UUID
- `sync:deviceToken` — auth token

### `requestDeferredPush()`

Same 2-second debounce pattern as desktop:
```typescript
let deferredPushTimer: ReturnType<typeof setTimeout> | null = null
export function requestDeferredPush(): void {
  if (deferredPushTimer) clearTimeout(deferredPushTimer)
  deferredPushTimer = setTimeout(() => {
    engine?.pushIncremental()
  }, 2000)
}
```

All CRUD service modules call `requestDeferredPush()` after writes.

## Diagnostic log convention

Mobile uses `[Sync:Engine]` prefix. These are still in the code (added
2026-07-24) and can be removed after stability is confirmed.

## Services layer

Mobile CRUD services mirror Desktop IPC handlers but use expo-sqlite API:

| Service | File | Notes |
|---|---|---|
| `saveAnnotation` | `services/annotations.service.ts` | COALESCE for `created_at` (fixed) |
| `deleteAnnotation` | `services/annotations.service.ts` | Cascade delete + changelog |
| `saveFSRSCard` | `services/fsrs-cards.service.ts` | COALESCE ✅ |
| `saveReviewLog` | `services/review-logs.service.ts` | Append-only INSERT ✅ |
| `saveAIResult` | `services/ai-results.service.ts` | COALESCE ✅ |
| `saveSummary` | `services/summaries.service.ts` | COALESCE ✅ |
| `saveDocument` | `services/documents.service.ts` | Drizzle ORM ✅ |
| `createFolder` | `services/folders.service.ts` | Drizzle ORM ✅ |

## File Map

| File | What |
|---|---|
| `apps/mobile/src/sync/sync-engine.ts` | Core engine (adapted from desktop) |
| `apps/mobile/src/sync/sync-client.ts` | HTTP client |
| `apps/mobile/src/sync/ws-client.ts` | WebSocket client |
| `apps/mobile/src/sync/changelog.ts` | Deletion tracking |
| `apps/mobile/src/sync/index.ts` | `requestDeferredPush` export |
| `apps/mobile/src/stores/sync.store.ts` | Zustand store + timestamp persistence |
| `apps/mobile/src/services/annotations.service.ts` | Annotation CRUD |
| `apps/mobile/src/services/fsrs-cards.service.ts` | FSRS card CRUD |
| `apps/mobile/src/services/review-logs.service.ts` | Review log CRUD |
