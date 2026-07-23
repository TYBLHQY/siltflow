/**
 * Server settings routes.
 *
 * GET   /api/settings   — read all settings (any authenticated device)
 * PATCH /api/settings   — update a setting (admin only)
 *
 * Settings are stored in the server_settings key-value table.
 * Currently supported keys:
 *   - pdf_sync_enabled: "true" | "false"
 */

import { Hono } from "hono";
import { getSqlite } from "../db";
import type { Variables } from "../types";

interface SettingRow {
  key: string;
  value: string;
  updatedAt: string;
}

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
    const ALLOWED_KEYS = ["pdf_sync_enabled"];
    if (!ALLOWED_KEYS.includes(body.key)) {
      return c.json({ error: `unknown setting key: ${body.key}` }, 400);
    }

    // Validate pdf_sync_enabled value
    if (body.key === "pdf_sync_enabled" && !["true", "false"].includes(body.value)) {
      return c.json({ error: "pdf_sync_enabled must be 'true' or 'false'" }, 400);
    }

    const now = new Date().toISOString();
    sql.prepare(
      "INSERT INTO server_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    ).run(body.key, body.value, now);

    const row = sql.prepare(
      "SELECT key, value, updated_at FROM server_settings WHERE key = ?"
    ).get(body.key) as { key: string; value: string; updated_at: string };

    return c.json({ key: row.key, value: row.value, updatedAt: row.updated_at });
  });
