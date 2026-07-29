/**
 * Health check endpoint — no auth required.
 * GET /health
 */

import { Hono } from "hono";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getSqlite } from "../db";
import { SV_SCHEMA_VERSION } from "../db/migrations";
import { SCHEMA_VERSION } from "@siltflow/shared-db/types";
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

  // Read schema versions at request time so migration state is accurate
  let sharedSchema = 0;
  let serverSchema = 0;
  const sql = getSqlite();
  if (sql) {
    sharedSchema = sql.pragma("user_version", { simple: true }) as number;
    const svRow = sql
      .prepare("SELECT value FROM server_settings WHERE key = 'schema_version'")
      .get() as { value: string } | undefined;
    serverSchema = svRow ? parseInt(svRow.value, 10) : 0;
  }

  return c.json({
    ok: true,
    version: PKG_VERSION,
    schema: {
      shared: sharedSchema,
      sharedLatest: SCHEMA_VERSION,
      server: serverSchema,
      serverLatest: SV_SCHEMA_VERSION,
    },
    uptime: process.uptime(),
    db: db ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});
