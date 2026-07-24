# Known Bugs & Pitfalls

This document records bugs we've already found and fixed, and remaining issues.
When debugging, check these patterns first.

## Timeline of the sync data corruption saga

The root cause was **timestamp-based change detection + server blind trust on
"created" classification**. This created a chain of failures:

1. **Epoch sync** (timestamps not persisted → all rows classified as "created")
2. **COALESCE bugs** (created_at reset on every save → updates misclassified as "created")
3. **Server's `INSERT OR REPLACE` on "created" rows** — no conflict detection

The fix (2026-07-24): **replaced the entire push detection mechanism with op_log**.
See [[sync-protocol]] for the new design.

### Why the old timestamp-based approach was fundamentally wrong

```
pushIncremental():
  since = lastPushAt
  "created": SELECT * WHERE created_at > since
  "updated": SELECT * WHERE updated_at > since AND created_at <= since

Server:
  "created" → INSERT OR REPLACE (no conflict check!)
  "updated" → checkConflict → UPDATE
```

Any clock skew, COALESCE bug, or timestamp persistence failure caused the client
to misclassify updates as "created", and the server blindly overwrote.

### Why op_log fixes it

```
Every write → record in sync_op_log (action='save'|'delete', row_data=full row JSON)
pushOpLog():
  entries = SELECT * FROM sync_op_log WHERE created_at > lastPushAt
  → POST {saves: [...], deletes: [...]}

Server:
  All "saves" → INSERT OR REPLACE (unconditional, no conflict detection needed)
  All "deletes" → DELETE + tombstone
```

No classification. No conflict detection. Server is a mirror. Single-user system.

## Fixed: Old bugs (pre-op_log era)

### Epoch sync on restart overwrites server data 🔴
**Fixed**: Timestamp persistence to config/settings.
Made irrelevant by op_log — lastPushAt is now just a fence, losing it only
causes a re-push of the same data (idempotent INSERT OR REPLACE).

### `annotations:save` resets `created_at` 🔴
**Fixed**: COALESCE in SQL.
Made irrelevant by op_log — the log records the row _after_ write, so the
correct created_at is captured automatically.

### Annotations delete doesn't record review_log deletions 🟡
**Fixed**: query IDs BEFORE delete, record each.
Still applies — op_log uses the same pattern.

### Server blind `INSERT OR REPLACE` on "created" rows 🔴
**Fixed**: Server push handler rewritten to accept `{saves, deletes}` without
distinction. No more checkConflict, applyUpdate, applyInsert.

## Remaining issues (not yet fixed)

### `sortDocMetrics` tiebreaker bug 🟢

`computeDocMetrics` sorts by `newCardsCount` with tiebreaker
`b.newCardsCount - b.newCardsCount` — always 0. Should be `a.title > b.title`.
File: `packages/shared-lib/src/doc-review.ts`.

### `listAllAnnotations` filter discrepancy 🟢

Stats uses `kind !== "highlight"` but review-metrics uses
`kind IN ('annotation', 'manual')`. Should be a single shared filter.

### Desktop pull write-back "sync echo" 🟡

Desktop pull applies remote rows via `INSERT OR REPLACE`, which bumps
`updated_at` on the local DB. With op_log, this will trigger a spurious save
in the op_log table unless the pull handler suppresses it or the op_log
deduplicates.
**Mitigated**: pull writes do NOT go through CRUD handlers, so they won't
generate op_log entries unless the upsertRemoteRow path is explicitly wired.

## Pre-deployment checklist

When making changes that touch sync, CRUD, or timestamps, verify:

1. **All writes (INSERT/UPDATE/DELETE) are recorded in sync_op_log**
2. **Pull-side writes (`upsertRemoteRow`) do NOT generate op_log entries**
3. **Timestamps are persisted on every sync completion** (still needed as fence)
4. **Both desktop and mobile are audited for the same patterns** (they mirror each other)
