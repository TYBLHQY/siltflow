/**
 * Tests for GET /health — the unauthenticated health check endpoint.
 *
 * The health route reads from getSqlite() (global singleton), so we need
 * a real on-disk DB. We use vi.resetModules() to reset the db module state
 * between test files so initDatabase() creates a fresh connection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import type { AppContext, Variables } from "../types";
import type { ServerConfig } from "../config";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Dynamic references — reassigned after vi.resetModules() in beforeEach.
let initDatabase: any;
let getDb: any;
let getSqlite: any;
let healthRoutes: any;

describe("GET /health", () => {
  let tmpDir: string;
  let app: Hono<{ Variables: Variables }>;

  beforeEach(async () => {
    // Reset db module singletons so each test gets a fresh DB.
    vi.resetModules();

    const [dbMod, healthMod] = await Promise.all([
      import("../db/index"),
      import("../routes/health"),
    ]);
    initDatabase = dbMod.initDatabase;
    getDb = dbMod.getDb;
    getSqlite = dbMod.getSqlite;
    healthRoutes = healthMod.healthRoutes;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "siltflow-health-test-"));
    initDatabase({
      port: 3001,
      dataDir: tmpDir,
      tombstoneRetentionDays: 30,
      bootstrapToken: undefined,
    });

    const db = getDb();
    // Build a minimal Hono app that injects ctx + config into every request
    app = new Hono<{ Variables: Variables }>();
    app.use("*", async (c: any, next: any) => {
      c.set("config", {
        port: 3001,
        dataDir: tmpDir,
        tombstoneRetentionDays: 30,
        bootstrapToken: undefined,
      } as ServerConfig);
      c.set("ctx", {
        getDb: () => db,
        wsHub: { broadcast: () => {}, attach: () => ({} as any) },
      } as AppContext);
      await next();
    });
    app.route("/health", healthRoutes);
  });

  afterEach(() => {
    // Close the DB connection before cleanup so the file is not locked.
    const sql = getSqlite();
    if (sql) sql.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 200 with ok: true", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns version from package.json", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(body.version).toBeDefined();
    expect(typeof body.version).toBe("string");
    // version should be semver-ish
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns schema information", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(body.schema).toBeDefined();
    expect(typeof body.schema.shared).toBe("number");
    expect(typeof body.schema.sharedLatest).toBe("number");
    expect(typeof body.schema.server).toBe("number");
    expect(typeof body.schema.serverLatest).toBe("number");
  });

  it("reports db as connected", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(body.db).toBe("connected");
  });

  it("reports uptime as a positive number", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(body.uptime).toBeGreaterThan(0);
  });

  it("reports a valid ISO timestamp", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).getTime()).toBeGreaterThan(0);
  });
});
