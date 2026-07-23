/**
 * Device management routes.
 *
 * GET    /api/devices          — list all registered devices (admin only)
 * POST   /api/devices/register — register a new device (admin only)
 * DELETE /api/devices/:id      — revoke a device token (admin only, can't self-revoke)
 *
 * The GET response includes last_seen_at (updated by auth middleware on every
 * authenticated request) and last_sync_at (updated on push/pull by sync routes).
 */

import { Hono } from "hono";
import { randomBytes, createHash } from "node:crypto";
import { getDb, getSqlite } from "../db";
import { devices } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Variables } from "../types";

interface DeviceInfo {
  id: string;
  name: string;
  isAdmin: boolean;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

export const deviceRoutes = new Hono<{ Variables: Variables }>()
  // ── List all devices (admin only) ──────────────────────────────────
  .get("/", (c) => {
    if (!c.var.isAdmin) return c.json({ error: "admin token required" }, 403);

    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    const rows = sql.prepare(
      `SELECT id, name, is_admin, last_seen_at, last_sync_at, created_at
       FROM devices ORDER BY created_at ASC`
    ).all() as Array<{
      id: string;
      name: string;
      is_admin: number;
      last_seen_at: string | null;
      last_sync_at: string | null;
      created_at: string;
    }>;

    const result: DeviceInfo[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      isAdmin: r.is_admin === 1,
      lastSeenAt: r.last_seen_at ?? null,
      lastSyncAt: r.last_sync_at ?? null,
      createdAt: r.created_at,
    }));

    return c.json(result);
  })
  // ── Register new device (admin only) ──────────────────────────────
  .post("/register", async (c) => {
    if (!c.var.isAdmin) return c.json({ error: "admin token required" }, 403);

    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);

    const body = await c.req.json<{ deviceName: string }>();
    if (!body?.deviceName) {
      return c.json({ error: "deviceName is required" }, 400);
    }

    const deviceId = randomBytes(16).toString("hex");
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date().toISOString();

    db.insert(devices)
      .values({
        id: deviceId,
        name: body.deviceName,
        tokenHash,
        isAdmin: false,
        createdAt: now,
      })
      .run();

    return c.json({
      deviceId,
      deviceName: body.deviceName,
      token,
      warning: "Save this token. It will not be shown again.",
    }, 201);
  })
  // ── Revoke device (admin only, can't self-revoke) ─────────────────
  .delete("/:id", (c) => {
    if (!c.var.isAdmin) return c.json({ error: "admin token required" }, 403);

    const targetId = c.req.param("id");
    if (targetId === c.var.deviceId) {
      return c.json({ error: "cannot revoke your own token" }, 400);
    }

    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);

    db.delete(devices).where(eq(devices.id, targetId)).run();

    return c.json({ ok: true });
  });
