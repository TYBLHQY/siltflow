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

    for (const table of ENTITY_TABLES) {
      const change = body.changes?.[table];
      if (!change) continue;

      // Process deletions first
      if (change.deleted) {
        for (const id of change.deleted) {
          // Record tombstone for pull
          const now = new Date().toISOString();
          sql.prepare(
            "INSERT INTO sync_tombstones (table_name, row_id, deleted_at) VALUES (?, ?, ?)"
          ).run(table, String(id), now);
          sql.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
          accepted++;
        }
      }

      // Process creates (INSERT OR REPLACE)
      if (change.created) {
        for (const row of change.created) {
          applyInsert(sql, table, row as Record<string, unknown>);
          accepted++;
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

    return c.json({ accepted, conflicts });
  })
  .post("/pull", async (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    const body = await c.req.json<{ lastSyncAt: string }>();
    const since = body.lastSyncAt ?? "1970-01-01T00:00:00Z";

    const changes: Record<string, Record<string, unknown>[]> = {};
    for (const table of ENTITY_TABLES) {
      // Skip review_logs — they use created_at, not updated_at
      const col = table === "review_logs" ? "created_at" : "updated_at";
      const rows = sql.prepare(
        `SELECT * FROM ${table} WHERE ${col} > ? ORDER BY ${col} ASC`
      ).all(since) as Record<string, unknown>[];
      if (rows.length) changes[table] = rows;
    }

    // Tombstones
    const tombstones = sql.prepare(
      "SELECT table_name, row_id, deleted_at FROM sync_tombstones WHERE deleted_at > ? ORDER BY deleted_at ASC"
    ).all(since) as Record<string, unknown>[];

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

    return c.json({ serverTime: now, changes, tombstones });
  });

// ── Helpers ────────────────────────────────────────────────────────────

function applyInsert(
  sql: ReturnType<typeof getSqlite>,
  table: string,
  row: Record<string, unknown>,
) {
  const keys = Object.keys(row);
  const placeholders = keys.map(() => "?").join(", ");
  const values = keys.map((k) => row[k]);
  sql!.prepare(
    `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`
  ).run(...values);
}

function applyUpdate(
  sql: ReturnType<typeof getSqlite>,
  table: string,
  row: Record<string, unknown>,
) {
  const { id, ...fields } = row;
  const sets = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(fields);
  sql!.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...values, id);
}

function checkConflict(
  sql: ReturnType<typeof getSqlite>,
  table: string,
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const existing = sql!.prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .get(row.id) as Record<string, unknown> | undefined;
  if (!existing) return null; // was deleted on server
  if (
    existing.updated_at &&
    row.updated_at &&
    new Date(existing.updated_at as string) > new Date(row.updated_at as string)
  ) {
    return { serverUpdatedAt: existing.updated_at, clientUpdatedAt: row.updated_at };
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
