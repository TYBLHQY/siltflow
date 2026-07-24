/**
 * Sync endpoints — push and pull.
 *
 * POST /api/sync/push  — client sends saves + deletes, server applies unconditionally
 * POST /api/sync/pull  — client requests changes since lastSyncAt
 *
 * Design: the server is a database mirror, not a conflict resolver. Every
 * client operation is trusted and applied as-is. The op-log approach on the
 * client ensures only genuinely new/changed rows are sent — no more
 * timestamp-based "created vs updated" classification bugs.
 */

import { Hono } from "hono";
import { getDb, getSqlite } from "../db";
import type { Variables } from "../types";
import {
  ENTITY_TABLES,
  type SyncPushBody,
} from "@siltflow/shared-lib";

// -- Routes --------------------------------------------------------------

export const syncRoutes = new Hono<{ Variables: Variables }>()
  .post("/push", async (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    const body = await c.req.json<SyncPushBody>();
    let accepted = 0;

    console.log("[Sync:Server] push from device:", c.var.deviceId,
      "lastSyncAt:", body.lastSyncAt);

    for (const table of ENTITY_TABLES) {
      const change = body.changes?.[table];
      if (!change) continue;

      const savesCount = change.saves?.length ?? 0;
      const deletesCount = change.deletes?.length ?? 0;
      console.log("[Sync:Server] push — table:", table,
        "saves:", savesCount, "deletes:", deletesCount);

      // Log fsrs_cards and review_logs data samples
      if ((table === "fsrs_cards" || table === "review_logs") && change.saves) {
        for (let i = 0; i < Math.min(change.saves.length, 3); i++) {
          console.log(`[Sync:Server] push — ${table}[${i}]:`, JSON.stringify(change.saves[i]).slice(0, 200));
        }
      }

      // Process deletions first (so a delete+save sequence for the same key works)
      if (change.deletes) {
        for (const rowId of change.deletes) {
          const now = new Date().toISOString();
          sql.prepare(
            "INSERT INTO sync_tombstones (table_name, row_id, deleted_at) VALUES (?, ?, ?)"
          ).run(table, String(rowId), now);

          const pk = parseRowId(table, rowId);
          const where = pkWhere(table, pk);
          sql.prepare(`DELETE FROM ${table} WHERE ${where.clause}`).run(
            ...where.values,
          );
          accepted++;
        }
      }

      // Process saves — unconditional INSERT OR REPLACE.
      // Server is a mirror: the client knows best what its data is.
      if (change.saves) {
        for (const row of change.saves) {
          const snaked = snakeKeys(row);
          const keys = Object.keys(snaked);
          const placeholders = keys.map(() => "?").join(", ");
          const values = keys.map((k) => snaked[k]);

          sql!.prepare(
            `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`
          ).run(...values);
          accepted++;
        }
      }
    }

    // Broadcast to other devices
    c.var.ctx.wsHub.broadcast("sync:available", {
      changedBy: c.var.deviceId,
      timestamp: new Date().toISOString(),
      accepted,
    });

    // Update device last_sync_at
    if (c.var.deviceId) {
      const now = new Date().toISOString();
      sql.prepare("UPDATE devices SET last_sync_at = ? WHERE id = ?").run(now, c.var.deviceId);
    }

    console.log("[Sync:Server] push — done, accepted:", accepted);

    return c.json({ accepted });
  })
  .post("/pull", async (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    const body = await c.req.json<{ lastSyncAt: string }>();
    const since = body.lastSyncAt ?? "1970-01-01T00:00:00Z";
    console.log("[Sync:Server] pull from device:", c.var.deviceId, "since:", since);

    const changes: Record<string, Record<string, unknown>[]> = {};
    for (const table of ENTITY_TABLES) {
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

    if (c.var.deviceId && tombstones.length > 0) {
      const ackStmt = sql.prepare(
        "INSERT OR IGNORE INTO sync_tombstone_acks (tombstone_id, device_id, acked_at) VALUES (?, ?, ?)"
      );
      const recentIds = sql.prepare(
        "SELECT id FROM sync_tombstones WHERE deleted_at > ? ORDER BY id ASC"
      ).all(since) as Array<{ id: number }>;
      for (const { id } of recentIds) {
        ackStmt.run(id, c.var.deviceId, now);
      }
      cleanTombstones(sql, c.var.config.tombstoneRetentionDays);
    }

    if (c.var.deviceId) {
      sql.prepare("UPDATE devices SET last_sync_at = ? WHERE id = ?").run(now, c.var.deviceId);
    }

    console.log("[Sync:Server] pull — done, changes:", Object.keys(changes).length,
      "tables, tombstones:", tombstones.length,
      "serverTime:", now);

    return c.json({ serverTime: now, changes, tombstones });
  });

// -- Key conversion ------------------------------------------------------

/** Convert camelCase keys to snake_case for SQL column names. */
function snakeKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const snake = key.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
    out[snake] = value;
  }
  return out;
}

// -- Composite primary key handling --------------------------------------

const COMPOSITE_PK: Record<string, string[]> = {
  annotations: ["id", "document_id"],
  ai_results: ["annotation_id", "document_id"],
  fsrs_cards: ["annotation_id", "document_id"],
  review_logs: ["id", "annotation_id", "document_id"],
};

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

// -- Tombstone cleanup --------------------------------------------------

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
