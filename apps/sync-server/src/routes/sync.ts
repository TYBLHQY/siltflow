/**
 * Sync endpoints — push and pull.
 *
 * POST /api/sync/push  — client sends local changes, server applies with conflict detection
 * POST /api/sync/pull  — client requests changes since lastSyncAt
 */

import { Hono } from "hono";
import { getDb, getSqlite } from "../db";
import type { Variables } from "../types";
import {
  ENTITY_TABLES,
  type SyncPushBody,
} from "@siltflow/shared-lib";

// ── Routes ────────────────────────────────────────────────────────────

export const syncRoutes = new Hono<{ Variables: Variables }>()
  .post("/push", async (c) => {
    const db = getDb();
    const sql = getSqlite();
    if (!db || !sql) return c.json({ error: "database not ready" }, 503);

    const body = await c.req.json<SyncPushBody>();
    let accepted = 0;
    const conflicts: Record<string, unknown>[] = [];

    console.log("[Sync:Server] push from device:", c.var.deviceId,
      "lastSyncAt:", body.lastSyncAt);

    for (const table of ENTITY_TABLES) {
      const change = body.changes?.[table];
      if (!change) continue;

      console.log("[Sync:Server] push — table:", table,
        "created:", change.created?.length ?? 0,
        "updated:", change.updated?.length ?? 0,
        "deleted:", change.deleted?.length ?? 0);

      // Log fsrs_cards and review_logs data samples from push
      if ((table === "fsrs_cards" || table === "review_logs") && change.created) {
        for (let i = 0; i < Math.min(change.created.length, 3); i++) {
          console.log(`[Sync:Server] push — ${table}[${i}]:`, JSON.stringify(change.created[i]).slice(0, 200));
        }
      }
      if ((table === "fsrs_cards") && change.updated) {
        for (let i = 0; i < Math.min(change.updated.length, 3); i++) {
          console.log(`[Sync:Server] push — ${table} UPDATE[${i}]:`, JSON.stringify(change.updated[i]).slice(0, 200));
        }
      }

      // Process deletions first
      if (change.deleted) {
        for (const rowId of change.deleted) {
          // Record tombstone for pull
          const now = new Date().toISOString();
          sql.prepare(
            "INSERT INTO sync_tombstones (table_name, row_id, deleted_at) VALUES (?, ?, ?)"
          ).run(table, String(rowId), now);

          // Build a PK-aware WHERE clause for the delete
          const pk = parseRowId(table, rowId);
          const where = pkWhere(table, pk);
          sql.prepare(`DELETE FROM ${table} WHERE ${where.clause}`).run(
            ...where.values,
          );
          accepted++;
        }
      }

      // Process creates — with existence check (was: blind INSERT OR REPLACE).
      // A client may misclassify an existing row as "created" (epoch sync,
      // COALESCE bug, cross-device race). applyInsert now checks whether the
      // row already exists and falls through to conflict detection when it does.
      if (change.created) {
        for (const row of change.created) {
          const conflict = applyInsert(sql, table, row as Record<string, unknown>);
          if (conflict) {
            conflicts.push({ table, id: (row as Record<string, unknown>).id, conflict });
          } else {
            accepted++;
          }
        }
      }

      // Process updates (with conflict check)
      if (change.updated) {
        for (const row of change.updated) {
          const conflict = checkConflict(sql, table, row as Record<string, unknown>);
          if (conflict) {
            conflicts.push({ table, id: (row as Record<string, unknown>).id, conflict });
          } else {
            applyUpdate(sql, table, row as Record<string, unknown>);
            accepted++;
          }
        }
      }
    }

    // Broadcast to other devices
    c.var.ctx.wsHub.broadcast("sync:available", {
      changedBy: c.var.deviceId,
      timestamp: new Date().toISOString(),
      accepted,
      conflictCount: conflicts.length,
    });

    // Update device last_sync_at
    if (c.var.deviceId) {
      const now = new Date().toISOString();
      sql.prepare("UPDATE devices SET last_sync_at = ? WHERE id = ?").run(now, c.var.deviceId);
    }

    console.log("[Sync:Server] push — done, accepted:", accepted, "conflicts:", conflicts.length);

    return c.json({ accepted, conflicts });
  })
  .post("/pull", async (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    const body = await c.req.json<{ lastSyncAt: string }>();
    const since = body.lastSyncAt ?? "1970-01-01T00:00:00Z";
    console.log("[Sync:Server] pull from device:", c.var.deviceId, "since:", since);

    const changes: Record<string, Record<string, unknown>[]> = {};
    for (const table of ENTITY_TABLES) {
      // Skip review_logs — they use created_at, not updated_at
      const col = table === "review_logs" ? "created_at" : "updated_at";
      const rows = sql.prepare(
        `SELECT * FROM ${table} WHERE ${col} > ? ORDER BY ${col} ASC`
      ).all(since) as Record<string, unknown>[];
      if (rows.length) changes[table] = rows;
      if (rows.length > 0) {
        console.log("[Sync:Server] pull — table:", table, "rows:", rows.length);
      }
    }

    // Tombstones
    const tombstones = sql.prepare(
      "SELECT table_name, row_id, deleted_at FROM sync_tombstones WHERE deleted_at > ? ORDER BY deleted_at ASC"
    ).all(since) as Record<string, unknown>[];
    if (tombstones.length > 0) {
      console.log("[Sync:Server] pull — tombstones:", tombstones.length);
    }

    const now = new Date().toISOString();

    // Mark tombstone acks for this device — it has now received these tombstones
    if (c.var.deviceId && tombstones.length > 0) {
      const ackStmt = sql.prepare(
        "INSERT OR IGNORE INTO sync_tombstone_acks (tombstone_id, device_id, acked_at) VALUES (?, ?, ?)"
      );
      // Need tombstone IDs, not just table_name + row_id — refetch by recent tombstones
      const recentIds = sql.prepare(
        "SELECT id FROM sync_tombstones WHERE deleted_at > ? ORDER BY id ASC"
      ).all(since) as Array<{ id: number }>;
      for (const { id } of recentIds) {
        ackStmt.run(id, c.var.deviceId, now);
      }
      // Also clean up fully-acked tombstones and time-expired ones
      cleanTombstones(sql, c.var.config.tombstoneRetentionDays);
    }

    // Update device last_sync_at
    if (c.var.deviceId) {
      sql.prepare("UPDATE devices SET last_sync_at = ? WHERE id = ?").run(now, c.var.deviceId);
    }

    console.log("[Sync:Server] pull — done, changes:", Object.keys(changes).length,
      "tables, tombstones:", tombstones.length,
      "serverTime:", now);

    return c.json({ serverTime: now, changes, tombstones });
  });

// ── Key conversion ──────────────────────────────────────────────────────

/** Convert camelCase keys to snake_case for SQL column names. */
function snakeKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const snake = key.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
    out[snake] = value;
  }
  return out;
}

// ── Composite primary key handling ───────────────────────────────────────

/**
 * Tables with composite primary keys. The server needs to know which
 * columns form the identity of each row to correctly build WHERE clauses
 * for DELETE, checkConflict, and applyUpdate.
 *
 * Mirrors COMPOSITE_PK_TABLES in both the desktop and mobile sync engines.
 */
const COMPOSITE_PK: Record<string, string[]> = {
  annotations: ["id", "document_id"],
  ai_results: ["annotation_id", "document_id"],
  fsrs_cards: ["annotation_id", "document_id"],
  review_logs: ["id", "annotation_id", "document_id"],
};

/**
 * Build a WHERE clause + bound values for a specific table's primary key,
 * using the row data. For simple-PK tables the clause is "id = ?".
 */
function pkWhere(
  table: string,
  row: Record<string, unknown>,
): { clause: string; values: unknown[] } {
  const cols = COMPOSITE_PK[table];
  if (cols) {
    const parts = cols.map((c) => `${c} = ?`);
    return { clause: parts.join(" AND "), values: cols.map((c) => row[c]) };
  }
  return { clause: "id = ?", values: [row.id] };
}

/**
 * Parse a pipe-delimited row_id back into per-column values for a composite
 * primary key table. The client encodes composite keys as "val1|val2|val3".
 */
function parseRowId(
  table: string,
  rowId: string,
): Record<string, unknown> {
  const cols = COMPOSITE_PK[table];
  if (cols) {
    const parts = rowId.split("|");
    const out: Record<string, unknown> = {};
    cols.forEach((c, i) => { out[c] = parts[i] ?? ""; });
    return out;
  }
  return { id: rowId };
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Apply a client-tagged "created" row with an existence check.
 *
 * We cannot trust the client's classification. A row may be misclassified
 * as "created" due to epoch sync, COALESCE bugs, DB recreation, or
 * cross-device races. Blind INSERT OR REPLACE would silently overwrite
 * fresher server data.
 *
 * Strategy: if the row already exists, treat as an update with full
 * conflict detection — same path as applyUpdate/checkConflict. If it
 * genuinely doesn't exist, insert it.
 *
 * @returns a ConflictItem if the operation was rejected, or null if accepted.
 */
function applyInsert(
  sql: ReturnType<typeof getSqlite>,
  table: string,
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const snaked = snakeKeys(row);
  const keys = Object.keys(snaked);
  const placeholders = keys.map(() => "?").join(", ");
  const values = keys.map((k) => snaked[k]);

  // Build a PK-aware WHERE clause for the existence check
  const pk = COMPOSITE_PK[table] ?? ["id"];
  const where = pk.map((c) => `${c} = ?`).join(" AND ");
  const pkValues = pk.map((c) => snaked[c]);
  const existing = sql!.prepare(
    `SELECT * FROM ${table} WHERE ${where}`,
  ).get(...pkValues) as Record<string, unknown> | undefined;

  if (existing) {
    // Row already exists — client misclassified an update as "created".
    console.log(
      `[Sync:Server] applyInsert — ${table} ALREADY EXISTS, treating as update.`,
      "Existing created_at:", existing.created_at,
      "incoming created_at:", snaked.created_at,
    );

    // Apply with conflict detection: reject if server has newer data
    if (
      existing.updated_at &&
      snaked.updated_at &&
      new Date(existing.updated_at as string) > new Date(snaked.updated_at as string)
    ) {
      console.log(
        `[Sync:Server] applyInsert — ${table} CONFLICT: server updated_at`,
        existing.updated_at, "> client updated_at", snaked.updated_at,
      );
      return {
        serverUpdatedAt: existing.updated_at,
        clientUpdatedAt: snaked.updated_at,
      };
    }

    // Safe to apply: update non-PK columns, preserve server's created_at
    const dataCols = Object.entries(snaked).filter(([k]) => !pk.includes(k));
    const setClause = dataCols.map(([k]) => `${k} = ?`).join(", ");
    const setValues = dataCols.map(([, v]) => v);
    sql!.prepare(
      `UPDATE ${table} SET ${setClause} WHERE ${where}`,
    ).run(...setValues, ...pkValues);

    console.log(`[Sync:Server] applyInsert — ${table} updated (was misclassified as created)`);
    return null; // accepted
  }

  // Genuinely new row — plain INSERT
  sql!.prepare(
    `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
  ).run(...values);

  console.log(`[Sync:Server] applyInsert — ${table} inserted (new row)`);
  return null; // accepted
}

function applyUpdate(
  sql: ReturnType<typeof getSqlite>,
  table: string,
  row: Record<string, unknown>,
) {
  const snaked = snakeKeys(row);
  const pkCols = COMPOSITE_PK[table] ?? ["id"];
  // Separate PK columns from data columns — don't SET PKs in UPDATE
  const fields = Object.fromEntries(
    Object.entries(snaked).filter(([k]) => !pkCols.includes(k)),
  );
  const sets = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
  const setValues = Object.values(fields);
  const where = pkWhere(table, snaked);
  sql!.prepare(
    `UPDATE ${table} SET ${sets} WHERE ${where.clause}`,
  ).run(...setValues, ...where.values);
}

function checkConflict(
  sql: ReturnType<typeof getSqlite>,
  table: string,
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const snaked = snakeKeys(row);
  const where = pkWhere(table, snaked);
  const existing = sql!.prepare(
    `SELECT * FROM ${table} WHERE ${where.clause}`,
  ).get(...where.values) as Record<string, unknown> | undefined;
  if (!existing) return null; // was deleted on server
  if (
    existing.updated_at &&
    snaked.updated_at &&
    new Date(existing.updated_at as string) > new Date(snaked.updated_at as string)
  ) {
    return { serverUpdatedAt: existing.updated_at, clientUpdatedAt: snaked.updated_at };
  }
  return null;
}

// ── Tombstone cleanup ───────────────────────────────────────────────────

/**
 * Remove tombstones that are no longer needed:
 * 1. All registered devices have acknowledged (safe to delete)
 * 2. OR the tombstone exceeds the retention period (safety net)
 */
export function cleanTombstones(
  sql: ReturnType<typeof getSqlite>,
  retentionDays: number,
): void {
  if (!sql) return;
  sql.exec(`
    DELETE FROM sync_tombstones
    WHERE id IN (
      SELECT t.id FROM sync_tombstones t
      WHERE NOT EXISTS (
        SELECT 1 FROM devices d
        WHERE NOT EXISTS (
          SELECT 1 FROM sync_tombstone_acks a
          WHERE a.tombstone_id = t.id AND a.device_id = d.id
        )
      )
      OR t.deleted_at < datetime('now', '-' || ${retentionDays} || ' days')
    )
  `);
}
