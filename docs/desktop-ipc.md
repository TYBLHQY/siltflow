# Desktop IPC Handlers

## Pattern

Each entity has an IPC handler file in `apps/desktop/electron/ipc/`:

```
registerXxxHandlers() → registers ipcMain.handle("xxx:action", ...)
```

All handlers access SQLite via `getSqlite()` which returns a `better-sqlite3`
Database instance (or null if DB is not ready).

## Handler inventory

| File | Channels | DB style |
|---|---|---|
| `documents.ipc.ts` | `documents:list`, `:get`, `:create`, `:delete`, `:rename`, `:updateMetadata`, `:updateSortOrder` | Drizzle |
| `folders.ipc.ts` | `folders:list`, `:create`, `:delete`, `:rename`, `:move`, `:moveDocuments`, `:updateSortOrder` | Drizzle |
| `annotations.ipc.ts` | `annotations:list`, `:listAll`, `:listAllByKind`, `:listByKind`, `:save`, `:delete` | Raw SQL |
| `ai-results.ipc.ts` | `aiResults:get`, `:listByDocument`, `:save`, `:delete` | Raw SQL |
| `fsrs-cards.ipc.ts` | `fsrsCards:get`, `:listByDocument`, `:listAll`, `:save`, `:delete` | Raw SQL |
| `summaries.ipc.ts` | `summaries:listAll`, `:get`, `:save`, `:delete` | Raw SQL |
| `review-logs.ipc.ts` | `reviewLogs:listByAnnotation`, `:listAll`, `:save`, `:deleteByAnnotation` | Raw SQL |
| `review.ipc.ts` | `review:getDueCards`, `:getDocMetrics` | Raw SQL |
| `sync.ipc.ts` | `sync:*` (see [[desktop-sync-engine]]) | — |
| `tts.ipc.ts` | `tts:speak`, `:getVoices`, etc. | Filesystem |

## better-sqlite3 API patterns

```typescript
// Query
const rows = sql.prepare("SELECT * FROM t WHERE id = ?").all(id) as RowType[]

// Single row
const row = sql.prepare("SELECT * FROM t WHERE id = ?").get(id) as RowType | undefined

// Mutation
sql.prepare("INSERT INTO t (...) VALUES (...)").run(val1, val2)

// Transaction
sql.exec("BEGIN TRANSACTION")
try {
  sql.prepare("DELETE ...").run(...)
  sql.prepare("INSERT ...").run(...)
  sql.exec("COMMIT")
} catch (e) {
  sql.exec("ROLLBACK")
  throw e
}
```

## Conventions

1. **Always check `if (!sql) return`** before using the DB — `getSqlite()` can
   return null if the DB hasn't been initialized yet.

2. **`changelogDeferred`**: Deletion changelog recording is deferred via
   `setImmediate` to avoid recursive DB access. The wrapper function checks
   if sql is still available.

3. **`requestDeferredPush()`** must be called after every write mutation.
   It's imported from `sync.ipc.ts` and debounces pushes by 2 seconds.

4. **Diagnostic logs** use `[Sync:Desktop]` prefix. They can be removed once
   sync stability is fully confirmed.

## Registration

All `registerXxxHandlers()` functions are called from `main.ts` →
`registerAllHandlers()`. The registration is guarded by a `handlersRegistered`
flag — safe to call multiple times, but only the first call takes effect.

There's also an `invalidateReviewMetricsCache()` hook used by handlers that
modify review-relevant data (annotations, FSRS cards, review logs). It
clears the in-memory metrics cache so the next `review:getDocMetrics` call
recomputes from fresh data.
