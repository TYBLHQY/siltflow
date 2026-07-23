/**
 * Server settings routes.
 *
 * GET   /api/settings   — read all settings (any authenticated device)
 * PATCH /api/settings   — update a setting (admin only)
 *
 * Settings are stored in the server_settings key-value table.
 */

import { Hono } from "hono";
import { getSqlite } from "../db";
import { ENTITY_TABLES } from "@siltflow/shared-lib";
import type { Variables } from "../types";

interface SettingRow {
  key: string;
  value: string;
  updatedAt: string;
}

/** All tables owned by the server database (shared entities + server-specific).
 *  server_settings is deliberately excluded — it holds the bootstrap token. */
const ALL_TABLES = [
  ...ENTITY_TABLES,
  "devices",
  "sync_tombstones",
  "sync_tombstone_acks",
];

export const settingsRoutes = new Hono<{ Variables: Variables }>()
  // ── Read all settings ─────────────────────────────────────────────
  .get("/", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    const rows = sql.prepare(
      "SELECT key, value, updated_at FROM server_settings ORDER BY key"
    ).all() as Array<{ key: string; value: string; updated_at: string }>;

    const result: SettingRow[] = rows.map((r) => ({
      key: r.key,
      value: r.value,
      updatedAt: r.updated_at,
    }));

    return c.json(result);
  })
  // ── Update a setting ──────────────────────────────────────────────
  .patch("/", async (c) => {
    if (!c.var.isAdmin) {
      return c.json({ error: "admin token required" }, 403);
    }

    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    const body = await c.req.json<{ key: string; value: string }>();
    if (!body?.key || body?.value === undefined) {
      return c.json({ error: "key and value are required" }, 400);
    }

    // Whitelist allowed keys
    const ALLOWED_KEYS = ["bootstrap_token", "server_token"];
    if (!ALLOWED_KEYS.includes(body.key)) {
      return c.json({ error: `unknown setting key: ${body.key}` }, 400);
    }

    const now = new Date().toISOString();
    sql.prepare(
      "INSERT INTO server_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    ).run(body.key, body.value, now);

    const row = sql.prepare(
      "SELECT key, value, updated_at FROM server_settings WHERE key = ?"
    ).get(body.key) as { key: string; value: string; updated_at: string };

    return c.json({ key: row.key, value: row.value, updatedAt: row.updated_at });
  })
  // ── Reset database — admin only, deletes all data ───────────────────
  .post("/reset-db", (c) => {
    if (!c.var.isAdmin) {
      return c.json({ error: "admin token required" }, 403);
    }

    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    const deleted: Record<string, number> = {};

    try {
      sql.exec("BEGIN TRANSACTION");

      for (const table of ALL_TABLES) {
        const result = sql.prepare(`DELETE FROM ${table}`).run();
        deleted[table] = result.changes;
      }

      // Reset schema version so initSchema re-runs on next startup
      sql.pragma("user_version = 0");

      sql.exec("COMMIT");

      return c.json({ ok: true, deleted });
    } catch (err) {
      sql.exec("ROLLBACK");
      return c.json(
        { error: (err as Error).message },
        500,
      );
    }
  });
