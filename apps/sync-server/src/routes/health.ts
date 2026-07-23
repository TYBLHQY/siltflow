/**
 * Health check endpoint — no auth required.
 * GET /health
 */

import { Hono } from "hono";
import type { Variables } from "../types";

export const healthRoutes = new Hono<{ Variables: Variables }>().get("/", (c) => {
  const db = c.var.ctx.getDb();
  return c.json({
    ok: true,
    uptime: process.uptime(),
    db: db ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});
