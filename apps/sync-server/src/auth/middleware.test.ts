/**
 * Tests for authMiddleware — Bearer token validation.
 *
 * The middleware checks Authorization header, looks up device tokens
 * via SHA-256 hash, and injects deviceId + isAdmin into context.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { createHash, randomBytes } from "node:crypto";
import type { AppContext, Variables } from "../types";
import type { ServerConfig } from "../config";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Dynamic references — reassigned after vi.resetModules().
let initDatabase: any;
let getDb: any;
let getSqlite: any;
let authMiddleware: any;

describe("authMiddleware", () => {
  let tmpDir: string;
  let app: Hono<{ Variables: Variables }>;
  let serverToken: string;
  let deviceToken: string;
  let deviceId: string;

  beforeEach(async () => {
    vi.resetModules();
    const [dbMod, authMod] = await Promise.all([
      import("../db/index"),
      import("../auth/middleware"),
    ]);
    initDatabase = dbMod.initDatabase;
    getDb = dbMod.getDb;
    getSqlite = dbMod.getSqlite;
    authMiddleware = authMod.authMiddleware;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "siltflow-auth-test-"));

    serverToken = randomBytes(32).toString("hex");
    deviceToken = randomBytes(32).toString("hex");
    deviceId = randomBytes(16).toString("hex");

    initDatabase({
      port: 3001,
      dataDir: tmpDir,
      tombstoneRetentionDays: 30,
      bootstrapToken: serverToken,
    });

    // Register a device in the DB
    const db = getDb();
    const { devices } = await import("../db/schema");
    const hash = createHash("sha256").update(deviceToken).digest("hex");
    db!.insert(devices).values({
      id: deviceId,
      name: "test-device",
      tokenHash: hash,
      isAdmin: false,
      createdAt: new Date().toISOString(),
    }).run();

    // Build app with middleware + a test endpoint
    app = new Hono<{ Variables: Variables }>();
    app.use("*", async (c: any, next: any) => {
      c.set("config", {
        port: 3001,
        dataDir: tmpDir,
        tombstoneRetentionDays: 30,
        bootstrapToken: serverToken,
      } as ServerConfig);
      c.set("ctx", {
        getDb: () => db,
        wsHub: { broadcast: () => {}, attach: () => ({} as any) },
      } as AppContext);
      await next();
    });
    app.use("*", authMiddleware);
    app.get("/test", (c: any) => {
      return c.json({ deviceId: c.var.deviceId, isAdmin: c.var.isAdmin });
    });
  });

  afterEach(() => {
    const sql = getSqlite();
    if (sql) sql.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 401 when no Authorization header is present", async () => {
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid token", async () => {
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(res.status).toBe(401);
  });

  it("accepts a valid device token and sets deviceId", async () => {
    const res = await app.request("/test", {
      headers: { Authorization: `Bearer ${deviceToken}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.deviceId).toBe(deviceId);
    expect(body.isAdmin).toBe(false);
  });

  it("accepts the server token and sets admin", async () => {
    const res = await app.request("/test", {
      headers: { Authorization: `Bearer ${serverToken}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.deviceId).toBe("server");
    expect(body.isAdmin).toBe(true);
  });

  it("skips auth for /api/auth paths", async () => {
    // Build a separate app where auth routes are NOT protected
    const openApp = new Hono<{ Variables: Variables }>();
    openApp.use("*", async (c: any, next: any) => {
      c.set("config", {
        port: 3001, dataDir: tmpDir, tombstoneRetentionDays: 30,
        bootstrapToken: serverToken,
      } as ServerConfig);
      c.set("ctx", {
        getDb: () => getDb(),
        wsHub: { broadcast: () => {}, attach: () => ({} as any) },
      } as AppContext);
      await next();
    });
    openApp.use("*", authMiddleware);
    openApp.get("/api/auth/register", (c: any) => c.json({ ok: true }));

    const res = await openApp.request("/api/auth/register");
    // Should pass through without auth
    expect(res.status).toBe(200);
  });
});
