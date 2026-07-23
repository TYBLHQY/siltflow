/**
 * Auth routes — device registration and management.
 *
 * POST /api/auth/bootstrap   — first device (admin), only when table is empty
 * POST /api/auth/register    — admin adds a new device
 * POST /api/auth/verify      — validate token, return device info
 * DELETE /api/auth/revoke/:id — admin revokes a device token
 */

import { Hono } from "hono";
import { createHash, randomBytes } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { getDb } from "../db";
import { devices } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Variables } from "../types";

/** Lightweight auth for /api/auth/* routes — verifies token, sets deviceId + isAdmin. */
const authVerify = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return next();

  const token = header.slice(7);
  const hash = createHash("sha256").update(token).digest("hex");

  const db = getDb();
  if (!db) return next();

  const device = db.select().from(devices).where(eq(devices.tokenHash, hash)).get();
  if (!device) return next();

  c.set("deviceId", device.id);
  c.set("isAdmin", device.isAdmin);
  await next();
});

export const authRoutes = new Hono<{ Variables: Variables }>()
  // Bootstrap: no auth required (or BOOTSTRAP_TOKEN env var)
  .post("/bootstrap", async (c) => {
    const config = c.var.config;
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);

    // Only works when no device exists
    const existing = db.select().from(devices).get();
    if (existing) {
      return c.json({ error: "bootstrap already completed" }, 409);
    }

    // Optional bootstrap secret
    if (config.bootstrapToken) {
      const header = c.req.header("Authorization");
      if (!header || header !== `Bearer ${config.bootstrapToken}`) {
        return c.json({ error: "invalid bootstrap token" }, 401);
      }
    }

    const body = await c.req.json<{ deviceName?: string }>();
    const deviceName = body?.deviceName ?? "Admin Device";

    const deviceId = randomBytes(16).toString("hex");
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date().toISOString();

    db.insert(devices)
      .values({
        id: deviceId,
        name: deviceName,
        tokenHash,
        isAdmin: true,
        createdAt: now,
      })
      .run();

    return c.json({
      deviceId,
      deviceName,
      token,
      serverUrl: c.req.url.replace(/\/api\/auth\/.*/, ""),
      warning: "Save this token. It will not be shown again.",
    }, 201);
  })
  // All remaining routes benefit from optional token verification
  .use("*", authVerify)
  .post("/register", async (c) => {
    if (!c.var.isAdmin) {
      return c.json({ error: "admin token required" }, 403);
    }

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
      serverUrl: c.req.url.replace(/\/api\/auth\/.*/, ""),
      warning: "Save this token. It will not be shown again.",
    }, 201);
  })
  .post("/verify", async (c) => {
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
  })
  .delete("/revoke/:deviceId", async (c) => {
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
