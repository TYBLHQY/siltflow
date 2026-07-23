/**
 * Bearer-token authentication middleware.
 *
 * Validates the Authorization header against the devices table,
 * injects deviceId + isAdmin into the request context,
 * and updates last_seen_at on each authenticated request.
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

    c.set("deviceId", device.id);
    c.set("isAdmin", device.isAdmin);

    // Update last_seen_at (fire-and-forget — don't block the request)
    const now = new Date().toISOString();
    db.update(devices).set({ lastSeenAt: now }).where(eq(devices.id, device.id)).run();

    await next();
  },
);
