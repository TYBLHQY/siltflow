/**
 * Tests for auth routes — device registration, verification, and revocation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { createHash, randomBytes } from "node:crypto";
import type { AppContext, Variables } from "../types";
import type { ServerConfig } from "../config";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let initDatabase: any;
let getDb: any;
let getSqlite: any;
let authRoutes: any;

describe("POST /api/auth/register", () => {
  let tmpDir: string;
  let app: Hono<{ Variables: Variables }>;
  let serverToken: string;

  beforeEach(async () => {
    vi.resetModules();
    const [dbMod, authMod] = await Promise.all([
      import("../db/index"),
      import("../routes/auth"),
    ]);
    initDatabase = dbMod.initDatabase;
    getDb = dbMod.getDb;
    getSqlite = dbMod.getSqlite;
    authRoutes = authMod.authRoutes;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "siltflow-auth-routes-"));
    serverToken = randomBytes(32).toString("hex");

    initDatabase({
      port: 3001,
      dataDir: tmpDir,
      tombstoneRetentionDays: 30,
      bootstrapToken: serverToken,
    });

    app = new Hono<{ Variables: Variables }>();
    app.use("*", async (c: any, next: any) => {
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
    app.route("/api/auth", authRoutes);
  });

  afterEach(() => {
    const sql = getSqlite();
    if (sql) sql.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects registration without server token", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceName: "my-laptop" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects registration with wrong server token", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong-token",
      },
      body: JSON.stringify({ deviceName: "my-laptop" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects registration without deviceName", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("registers a new device with server token", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverToken}`,
      },
      body: JSON.stringify({ deviceName: "my-ipad" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json() as any;
    expect(body.deviceId).toBeDefined();
    expect(body.deviceName).toBe("my-ipad");
    expect(body.token).toBeDefined();
    expect(body.token.length).toBe(64); // 32 bytes hex
    expect(body.warning).toContain("Save this device token");
  });

  it("allows re-registration with an existing device ID", async () => {
    // First registration
    const res1 = await app.request("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverToken}`,
      },
      body: JSON.stringify({ deviceName: "device-v2", deviceId: "fixed-id" }),
    });
    expect(res1.status).toBe(201);
    const body1 = await res1.json() as any;

    // Re-registration
    const res2 = await app.request("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverToken}`,
      },
      body: JSON.stringify({ deviceName: "device-v2-renamed", deviceId: "fixed-id" }),
    });
    expect(res2.status).toBe(200);
    const body2 = await res2.json() as any;
    expect(body2.deviceId).toBe("fixed-id");
    expect(body2.deviceName).toBe("device-v2-renamed");
    expect(body2.token).not.toBe(body1.token);
  });

  it("returns server URL in registration response", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverToken}`,
      },
      body: JSON.stringify({ deviceName: "test" }),
    });
    const body = await res.json() as any;
    expect(body.serverUrl).toBeDefined();
    expect(body.serverUrl).not.toContain("/api/auth");
  });
});

describe("POST /api/auth/verify", () => {
  let tmpDir: string;
  let app: Hono<{ Variables: Variables }>;
  let serverToken: string;
  let deviceToken: string;
  let deviceId: string;

  beforeEach(async () => {
    vi.resetModules();
    const [dbMod, authMod] = await Promise.all([
      import("../db/index"),
      import("../routes/auth"),
    ]);
    initDatabase = dbMod.initDatabase;
    getDb = dbMod.getDb;
    getSqlite = dbMod.getSqlite;
    authRoutes = authMod.authRoutes;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "siltflow-auth-verify-"));
    serverToken = randomBytes(32).toString("hex");
    deviceToken = randomBytes(32).toString("hex");
    deviceId = "dev-verify-1";

    initDatabase({
      port: 3001,
      dataDir: tmpDir,
      tombstoneRetentionDays: 30,
      bootstrapToken: serverToken,
    });

    // Register device directly
    const db = getDb();
    const { devices } = await import("../db/schema");
    const hash = createHash("sha256").update(deviceToken).digest("hex");
    db!.insert(devices).values({
      id: deviceId,
      name: "verify-test-device",
      tokenHash: hash,
      isAdmin: false,
      createdAt: new Date().toISOString(),
    }).run();

    app = new Hono<{ Variables: Variables }>();
    app.use("*", async (c: any, next: any) => {
      c.set("config", {
        port: 3001, dataDir: tmpDir, tombstoneRetentionDays: 30,
        bootstrapToken: serverToken,
      } as ServerConfig);
      c.set("ctx", {
        getDb: () => db,
        wsHub: { broadcast: () => {}, attach: () => ({} as any) },
      } as AppContext);
      await next();
    });
    app.route("/api/auth", authRoutes);
  });

  afterEach(() => {
    const sql = getSqlite();
    if (sql) sql.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("verifies a valid device token", async () => {
    const res = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${deviceToken}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.deviceId).toBe(deviceId);
    expect(body.deviceName).toBe("verify-test-device");
  });

  it("verifies the server token as admin", async () => {
    const res = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${serverToken}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.isAdmin).toBe(true);
  });

  it("returns 401 for invalid token", async () => {
    const res = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { Authorization: "Bearer garbage" },
    });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/auth/revoke/:deviceId", () => {
  let tmpDir: string;
  let app: Hono<{ Variables: Variables }>;
  let serverToken: string;
  let adminToken: string;
  let deviceToken: string;

  beforeEach(async () => {
    vi.resetModules();
    const [dbMod, authMod] = await Promise.all([
      import("../db/index"),
      import("../routes/auth"),
    ]);
    initDatabase = dbMod.initDatabase;
    getDb = dbMod.getDb;
    getSqlite = dbMod.getSqlite;
    authRoutes = authMod.authRoutes;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "siltflow-auth-revoke-"));
    serverToken = randomBytes(32).toString("hex");
    adminToken = randomBytes(32).toString("hex");
    deviceToken = randomBytes(32).toString("hex");

    initDatabase({
      port: 3001,
      dataDir: tmpDir,
      tombstoneRetentionDays: 30,
      bootstrapToken: serverToken,
    });

    const db = getDb();
    const { devices } = await import("../db/schema");

    // Register an admin device
    db!.insert(devices).values({
      id: "admin-dev",
      name: "admin-device",
      tokenHash: createHash("sha256").update(adminToken).digest("hex"),
      isAdmin: true,
      createdAt: new Date().toISOString(),
    }).run();

    // Register a non-admin device
    db!.insert(devices).values({
      id: "non-admin-dev",
      name: "regular-device",
      tokenHash: createHash("sha256").update(deviceToken).digest("hex"),
      isAdmin: false,
      createdAt: new Date().toISOString(),
    }).run();

    app = new Hono<{ Variables: Variables }>();
    app.use("*", async (c: any, next: any) => {
      c.set("config", {
        port: 3001, dataDir: tmpDir, tombstoneRetentionDays: 30,
        bootstrapToken: serverToken,
      } as ServerConfig);
      c.set("ctx", {
        getDb: () => db,
        wsHub: { broadcast: () => {}, attach: () => ({} as any) },
      } as AppContext);
      await next();
    });
    app.route("/api/auth", authRoutes);
  });

  afterEach(() => {
    const sql = getSqlite();
    if (sql) sql.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects revocation without auth", async () => {
    const res = await app.request("/api/auth/revoke/non-admin-dev", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  it("rejects revocation by non-admin device", async () => {
    const res = await app.request("/api/auth/revoke/admin-dev", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${deviceToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("allows admin to revoke another device", async () => {
    const res = await app.request("/api/auth/revoke/non-admin-dev", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    expect((await res.json() as any).ok).toBe(true);

    // Verify the revoked device no longer exists in the DB
    const sql = getSqlite();
    const row = sql!.prepare("SELECT id FROM devices WHERE id = ?").get("non-admin-dev");
    expect(row).toBeUndefined();
  });

  it("prevents revoking your own token", async () => {
    const res = await app.request("/api/auth/revoke/admin-dev", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
  });
});
