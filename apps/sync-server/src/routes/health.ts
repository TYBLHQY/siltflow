/**
 * Health check endpoint — no auth required.
 * GET /health
 */

import { Hono } from "hono";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Variables } from "../types";

// Read version from package.json.
//
// Bundled CJS (esbuild): __dirname = .../dist → ../package.json
// Dev ESM (tsx):         import.meta.url = file://.../src/routes/health.ts → ../../package.json
const PKG_VERSION: string = (() => {
  const dir =
    typeof __dirname !== "undefined"
      ? __dirname
      : path.dirname(new URL(import.meta.url).pathname);
  const candidates = ["../package.json", "../../package.json"];
  for (const rel of candidates) {
    try {
      const pkgPath = path.resolve(dir, rel);
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      return pkg.version ?? "unknown";
    } catch { /* try next */ }
  }
  return "unknown";
})();

export const healthRoutes = new Hono<{ Variables: Variables }>().get("/", (c) => {
  const db = c.var.ctx.getDb();
  return c.json({
    ok: true,
    version: PKG_VERSION,
    uptime: process.uptime(),
    db: db ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});
