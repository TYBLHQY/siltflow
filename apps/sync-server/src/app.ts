/**
 * Hono app factory — middleware stack + route mounting.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./auth/middleware";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import type { ServerConfig } from "./config";
import type { AppContext, Variables } from "./types";

export function createApp(config: ServerConfig, ctx: AppContext) {
  const app = new Hono<{ Variables: Variables }>();

  // ── Global middleware ─────────────────────────────────────────────
  app.use("*", logger());
  app.use("*", cors());

  // Inject config + context into every request
  app.use("*", async (c, next) => {
    c.set("config", config);
    c.set("ctx", ctx);
    await next();
  });

  // ── Public routes (no auth) ───────────────────────────────────────
  app.route("/health", healthRoutes);
  app.route("/api/auth", authRoutes);

  // ── Protected routes ──────────────────────────────────────────────
  // Middleware itself skips /api/auth paths
  app.use("/api/*", authMiddleware);

  // TODO: mount entity routes in subsequent steps

  return app;
}
