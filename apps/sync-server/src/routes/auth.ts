/**
 * Auth routes — device registration and verification.
 *
 * POST /api/auth/register — register a new device (requires server token)
 * POST /api/auth/verify    — validate a device token, return device info
 * DELETE /api/auth/revoke/:id — admin revokes a device token
 *
 * Two levels of auth:
 *   Server token (bootstrapToken) — static secret, proves you can join this server.
 *   Device token                    — per-device secret, returned after registration.
 */

import { Hono } from "hono";
import { createHash, randomBytes } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { getDb } from "../db";
import { devices } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Variables } from "../types";

/** Verify device token — sets deviceId + isAdmin if valid, continues regardless. */
const deviceAuth = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    const hash = createHash("sha256").update(token).digest("hex");
    const db = getDb();
    if (db) {
      const device = db.select().from(devices).where(eq(devices.tokenHash, hash)).get();
      if (device) {
        c.set("deviceId", device.id);
        c.set("isAdmin", device.isAdmin);
      }
    }
  }
  await next();
});

export const authRoutes = new Hono<{ Variables: Variables }>()
  // ── Register device (requires server token) ─────────────────────────
  .post("/register", async (c) => {
    const config = c.var.config;
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);

    // Verify server token
    if (!config.bootstrapToken) {
      return c.json({ error: "server not configured" }, 500);
    }
    const header = c.req.header("Authorization");
    if (!header || header !== `Bearer ${config.bootstrapToken}`) {
      return c.json({ error: "invalid server token" }, 401);
    }

    const body = await c.req.json<{ deviceName: string; deviceId?: string }>();
    if (!body?.deviceName) {
      return c.json({ error: "deviceName is required" }, 400);
    }

    const now = new Date().toISOString();
    let deviceId: string;
    let token: string;

    if (body.deviceId) {
      // Re-registration: check if device already exists
      const existing = db
        .select()
        .from(devices)
        .where(eq(devices.id, body.deviceId))
        .get();
      if (existing) {
        // Return existing device info (don't generate new token)
        return c.json({
          deviceId: existing.id,
          deviceName: existing.name,
          token: "", // token is not recoverable — client should already have it
          serverUrl: c.req.url.replace(/\/api\/auth\/.*/, ""),
          warning: "",
        });
      }
    }

    // New device registration
    deviceId = body.deviceId ?? randomBytes(16).toString("hex");
    token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");

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
      serverUrl: c.req.url.replace(/\/api\/auth\/.*/, ""),
      warning: "Save this device token. It will not be shown again.",
    }, 201);
  })
  // ── Verify device or server token ───────────────────────────────────
  .use("*", deviceAuth)
  .post("/verify", async (c) => {
    // Accept either a valid device token OR the server token.
    // Device tokens are validated by the deviceAuth middleware above.
    // Server token is checked explicitly so admins can log into the dashboard
    // before any device is registered.
    if (c.var.deviceId) {
      // Validated by deviceAuth
      const db = getDb();
      if (!db) return c.json({ error: "database not ready" }, 503);
      const device = db
        .select()
        .from(devices)
        .where(eq(devices.id, c.var.deviceId))
        .get();
      if (!device) return c.json({ error: "device not found" }, 404);
      return c.json({
        deviceId: device.id,
        deviceName: device.name,
        isAdmin: device.isAdmin,
      });
    }

    // Fall back: check if the token matches the server token
    const config = c.var.config;
    if (config.bootstrapToken) {
      const header = c.req.header("Authorization");
      if (header === `Bearer ${config.bootstrapToken}`) {
        return c.json({
          deviceId: "server",
          deviceName: "Admin Dashboard",
          isAdmin: true,
        });
      }
    }

    return c.json({ error: "invalid token" }, 401);
  })
  // ── Revoke device token (requires existing device auth, admin only) ──
  .delete("/revoke/:deviceId", async (c) => {
    if (!c.var.deviceId) {
      return c.json({ error: "authentication required" }, 401);
    }
    if (!c.var.isAdmin) {
      return c.json({ error: "admin token required" }, 403);
    }

    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);

    const targetId = c.req.param("deviceId");
    if (targetId === c.var.deviceId) {
      return c.json({ error: "cannot revoke your own token" }, 400);
    }

    db.delete(devices).where(eq(devices.id, targetId)).run();

    return c.json({ ok: true });
  });
