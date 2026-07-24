# Known Bugs & Pitfalls

This document records bugs we've already found and fixed, and remaining issues.
When debugging, check these patterns first.

## Fixed: Epoch sync on restart overwrites server data 🔴

**Severity**: Critical (data loss)  
**Found**: 2026-07-24  
**Affected**: Desktop, Mobile  
**Commits**: `95d0da6` (desktop), `b45d1c8` (mobile)

### Root cause
`lastPushAt` / `lastPullAt` were never persisted across restarts. On restart
both were `null` → `since: "1970-01-01T00:00:00Z"` → ALL rows classified as
"created" → server `INSERT OR REPLACE` without conflict detection → any fresher
data from other devices silently overwritten.

### Fix
Desktop: persist timestamps to `{vaultPath}/.siltflow/config.json` on every
sync completion via `onStateChange` callback.
Mobile: persist to `app_settings` table in SQLite.

### Prevention
When adding a new sync client platform, ALWAYS implement timestamp persistence
before the first sync runs. See [[sync-protocol#timestamp-persistence]].

---

## Fixed: `annotations:save` resets `created_at` 🔴

**Severity**: Critical (data corruption)  
**Found**: 2026-07-24  
**Affected**: Desktop, Mobile  
**Commits**: `2dbba98` (desktop), `97675d4` (mobile)

### Root cause
`INSERT OR REPLACE INTO annotations (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
set `created_at = now` every time. No COALESCE.

### Effect
Every annotation save → `created_at` reset → pushIncremental classifies as
"created" (since `created_at > lastPushAt`) → server `INSERT OR REPLACE`
without conflict detection → other concurrent annotation changes lost.

### Fix
```sql
INSERT OR REPLACE INTO annotations (..., created_at, updated_at)
VALUES (...,
  COALESCE((SELECT created_at FROM annotations WHERE id = ? AND document_id = ?), ?),
  ?)
```

### Prevention
Every `INSERT OR REPLACE` on a table with `created_at` MUST use COALESCE.
Audit checklist:
- [ ] `annotations` — uses `INSERT OR REPLACE` → needs COALESCE
- [ ] `ai_results` — has COALESCE ✅
- [ ] `fsrs_cards` — has COALESCE ✅
- [ ] `summaries` — has COALESCE ✅
- [ ] `review_logs` — uses plain `INSERT INTO` (append-only) ✅
- [ ] `documents` — uses Drizzle `insert()` (separate from `update()`) ✅
- [ ] `folders` — uses Drizzle `insert()` (separate from `update()`) ✅

---

## Fixed: Concurrent pull race condition 🟡

**Severity**: Medium (duplicate work, not data loss)  
**Found**: 2026-07-24  
**Affected**: Desktop, Mobile  
**Commits**: `1575402` (desktop), `9d1ad90` (mobile)

### Root cause
`_syncInProgress` guard prevented concurrent `sync()` calls, but `pull()` could
be called independently via WebSocket "sync:available" handler. No guard on
`pull()` itself.

### Fix
Added dedicated `_pullInProgress` flag to `pull()`. Also `_pushInProgress` for
`pushIncremental()`.

### Prevention
Any function that can be called from multiple code paths (sync cycle + event
handler) needs its own guard flag.

---

## Fixed: Annotations delete doesn't record review_log deletions 🟡

**Severity**: Medium (orphaned data on other devices)  
**Found**: 2026-07-24  
**Affected**: Desktop, Mobile  
**Commit**: `97675d4`

### Root cause
Desktop: `annotations:delete` never called `recordDeletion` for `review_logs`.
Mobile: Queried review_log IDs AFTER the DELETE (empty result).

### Fix
Desktop: added `recordDeletion` for each review_log.
Mobile: moved ID collection BEFORE the transaction.

### Prevention
Pattern: collect IDs → delete → record deletions. Always verify the order.

---

## Remaining issues (not yet fixed)

### `sortDocMetrics` tiebreaker bug 🟢

`computeDocMetrics` sorts by `newCardsCount` with tiebreaker
`b.newCardsCount - b.newCardsCount` — always 0. Should be `a.title > b.title`.
File: `packages/shared-lib/src/doc-review.ts`.

### `listAllAnnotations` filter discrepancy 🟢

Stats uses `kind !== "highlight"` but review-metrics uses
`kind IN ('annotation', 'manual')`. Should be a single shared filter.
Files: review-related components.

### Desktop pull write-back "sync echo" 🟡

Desktop pull applies remote rows via `INSERT OR REPLACE`, which bumps
`updated_at` on the local DB. If those updated rows fall within the next
pushIncremental window, they get pushed back to the server as "updated"
changes — even though nothing actually changed locally.
File: `apps/desktop/electron/sync/sync-engine.ts` → `upsertRemoteRow`.

### Mobile `pushFull` called on startup instead of `pushIncremental` 🟡

Early mobile startup ran `pushFull()` → all rows sent as "created". Fixed by
commit `aaf32cc` to use `pushIncremental` instead, but worth noting: any code
path calling `pushFull()` during normal operation is a bug.

---

## Pre-deployment checklist

When making changes that touch sync, CRUD, or timestamps, verify:

1. **No new code path calls `pushFull()` during normal operation**
2. **All `INSERT OR REPLACE` on entity tables use COALESCE for `created_at`**
3. **All DELETE operations record deletions BEFORE the delete (for composite PK tables that need ID queries)**
4. **Timestamps are persisted on every sync completion**
5. **Both desktop and mobile are audited for the same patterns** (they mirror each other)
