# Deletion Changelog

## Why it exists

Push incremental detects creates and updates via timestamp queries:
```sql
-- Created: row didn't exist before last push
SELECT * FROM table WHERE created_at > lastPushAt
-- Updated: row existed but was modified
SELECT * FROM table WHERE updated_at > lastPushAt AND created_at <= lastPushAt
```

Deletions leave no row behind — there's nothing to query. The changelog table
records what was deleted so the push engine can include `deleted: ["rowId"]`
in the push body.

## Schema

```sql
CREATE TABLE IF NOT EXISTS sync_changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,   -- entity table name
  row_id TEXT NOT NULL,       -- pipe-delimited composite key, or plain id
  action TEXT NOT NULL DEFAULT 'delete',
  created_at TEXT NOT NULL    -- when the deletion was recorded
);
```

## Row ID encoding

Single-PK tables (`documents`, `folders`, `summaries`): plain `id` string.

Composite-PK tables: pipe-delimited segments matching the canonical column order:

| Table | row_id format |
|---|---|
| `annotations` | `"id|document_id"` |
| `ai_results` | `"annotation_id|document_id"` |
| `fsrs_cards` | `"annotation_id|document_id"` |
| `review_logs` | `"id|annotation_id|document_id"` |

## Desktop vs Mobile implementations

Both implement the same API but differ in how they access SQLite:

| Aspect | Desktop (`electron/sync/changelog.ts`) | Mobile (`src/sync/changelog.ts`) |
|---|---|---|
| DB access | `sql: Database.Database` passed as param | `getSQLite()` singleton |
| Composite PK helper | N/A — caller encodes | `recordCompositeDeletion(table, pkValues)` |
| Init | `initChangelogTable(sql)` | `initChangelogTable()` (no-arg) |

**Mobile has `recordCompositeDeletion`** which takes a `{column: value}` object
and builds the pipe-delimited `row_id` automatically. Desktop doesn't have this
helper — each caller manually constructs the pipe-delimited string.

## Lifecycle

1. **Record**: Called before or alongside the actual `DELETE FROM table WHERE ...`
2. **Push**: `getDeletionsSince(since)` returns all un-pushed deletions
3. **Clear**: `clearDeletions(ids)` removes entries after server accepts

## Critical bugs fixed

### Review log deletions not recorded

**Desktop** `annotations:delete` never called `recordDeletion` for `review_logs`.
The code deleted review_logs in SQL but never recorded them in the changelog.
Other devices never learned about those deletions. **Fixed 2026-07-24**.

### Review log IDs queried AFTER deletion

**Mobile** `deleteAnnotation` collected review_log IDs from the DB *after*
deleting them — the query returned `[]`. Same effect: no review_log deletions
ever pushed. **Fixed 2026-07-24**.

### Must query log IDs BEFORE the transaction deletes them

The correct pattern:
```typescript
// 1. Collect IDs FIRST
const logRows = db.getAllSync("SELECT id FROM review_logs WHERE ...")

// 2. Then delete (in transaction)
db.execSync("BEGIN TRANSACTION")
db.runSync("DELETE FROM review_logs WHERE ...")
// ... other deletes ...
db.execSync("COMMIT")

// 3. Now record deletions (after COMMIT so DB is consistent)
for (const row of logRows) {
  recordCompositeDeletion("review_logs", { id: row.id, ... })
}
```

## File Map

| File | What |
|---|---|
| `apps/desktop/electron/sync/changelog.ts` | Desktop implementation |
| `apps/mobile/src/sync/changelog.ts` | Mobile implementation |
| `apps/desktop/electron/ipc/annotations.ipc.ts` | `annotations:delete` — records deletions here |
| `apps/mobile/src/services/annotations.service.ts` | `deleteAnnotation` — records deletions here |
