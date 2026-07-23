/**
 * Bearer-token authentication middleware.
 *
 * Validates the Authorization header against the devices table
 * and injects deviceId + isAdmin into the request context.
 */

import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";
import { getDb } from "../db";
import { devices } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Variables } from "../types";

export const authMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    // Skip /api/auth routes
    if (c.req.path.startsWith("/api/auth")) return next();

    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const token = header.slice(7);
    const hash = createHash("sha256").update(token).digest("hex");

    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);

    const device = db
      .select()
      .from(devices)
      .where(eq(devices.tokenHash, hash))
      .get();

    if (!device) return c.json({ error: "invalid token" }, 401);

    // Update last seen timestamp (best-effort)
    try {
      const now = new Date().toISOString();
      db.update(devices).set({ lastSeenAt: now }).where(eq(devices.id, device.id)).run();
    } catch {
      // best-effort; don't block on timestamp update failure
    }

    c.set("deviceId", device.id);
    c.set("isAdmin", device.isAdmin);

    await next();
  },
);
