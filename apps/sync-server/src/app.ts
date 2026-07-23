/**
 * Hono app factory — middleware stack + route mounting.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./auth/middleware";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { documentRoutes } from "./routes/documents";
import { folderRoutes } from "./routes/folders";
import { annotationRoutes } from "./routes/annotations";
import { aiResultRoutes } from "./routes/ai-results";
import { fsrsCardRoutes } from "./routes/fsrs-cards";
import { reviewLogRoutes } from "./routes/review-logs";
import { summaryRoutes } from "./routes/summaries";
import { statsRoutes } from "./routes/stats";
import { syncRoutes } from "./routes/sync";
import { createFileRoutes } from "./routes/files";
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
  const api = new Hono<{ Variables: Variables }>();
  api.use("*", authMiddleware);

  // Entity CRUD
  api.route("/documents", documentRoutes);
  api.route("/folders", folderRoutes);
  // Annotations/AI/FSRS/ReviewLogs use nested paths like
  //   /api/documents/:docId/annotations  and  /api/annotations
  // so mount at api root
  api.route("/", annotationRoutes);
  api.route("/", aiResultRoutes);
  api.route("/", fsrsCardRoutes);
  api.route("/", reviewLogRoutes);
  api.route("/", summaryRoutes);

  // Sync
  api.route("/sync", syncRoutes);

  // Stats (read-only)
  api.route("/stats", statsRoutes);

  // Files (PDF upload/download)
  api.route("/files", createFileRoutes(config.dataDir));

  app.route("/api", api);

  return app;
}
