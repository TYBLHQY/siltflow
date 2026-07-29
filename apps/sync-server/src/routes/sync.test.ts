/**
 * Tests for sync routes — push and pull.
 *
 * These test the core sync protocol: clients push saves + deletes,
 * and pull changes since their last sync timestamp.
 *
 * Column names match the real @siltflow/shared-db/schema:
 *   documents: id, title, original_name, total_pages, metadata, folder_id,
 *              sort_order, created_at, updated_at
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import type { AppContext, Variables } from "../types";
import type { ServerConfig } from "../config";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let initDatabase: any;
let getDb: any;
let getSqlite: any;
let syncRoutes: any;

function setupApp(tmpDir: string) {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c: any, next: any) => {
    c.set("config", {
      port: 3001, dataDir: tmpDir, tombstoneRetentionDays: 30,
      bootstrapToken: undefined,
    } as ServerConfig);
    c.set("ctx", {
      getDb: () => getDb(),
      wsHub: { broadcast: () => {}, attach: () => ({} as any) },
    } as AppContext);
    // Set a deviceId (simulating authenticated request)
    c.set("deviceId", "sync-test-device");
    c.set("isAdmin", false);
    await next();
  });
  app.route("/api/sync", syncRoutes);
  return app;
}

describe("POST /api/sync/push", () => {
  let tmpDir: string;
  let app: Hono<{ Variables: Variables }>;

  beforeEach(async () => {
    vi.resetModules();
    const [dbMod, syncMod] = await Promise.all([
      import("../db/index"),
      import("../routes/sync"),
    ]);
    initDatabase = dbMod.initDatabase;
    getDb = dbMod.getDb;
    getSqlite = dbMod.getSqlite;
    syncRoutes = syncMod.syncRoutes;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "siltflow-sync-push-"));
    initDatabase({
      port: 3001, dataDir: tmpDir, tombstoneRetentionDays: 30,
      bootstrapToken: undefined,
    });

    app = setupApp(tmpDir);
  });

  afterEach(() => {
    const sql = getSqlite();
    if (sql) sql.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("accepts an empty push", async () => {
    const res = await app.request("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: {} }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.accepted).toBe(0);
  });

  it("pushes a new document save", async () => {
    const now = new Date().toISOString();
    const res = await app.request("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changes: {
          documents: {
            saves: [{
              id: "doc-1",
              title: "Test Document",
              folder_id: null,
              sort_order: 0,
              created_at: now,
              updated_at: now,
            }],
          },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.accepted).toBe(1);

    // Verify it was saved
    const sql = getSqlite();
    const row = sql!.prepare("SELECT title FROM documents WHERE id = ?").get("doc-1") as any;
    expect(row.title).toBe("Test Document");
  });

  it("pushes a document deletion", async () => {
    const now = new Date().toISOString();
    const sql = getSqlite();

    // First insert a document directly
    sql!.prepare(`
      INSERT INTO documents (id, title, created_at, updated_at, sort_order)
      VALUES (?, ?, ?, ?, 0)
    `).run("doc-del", "To Delete", now, now);

    // Then push a deletion
    const res = await app.request("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changes: {
          documents: {
            deletes: ["doc-del"],
          },
        },
      }),
    });
    expect(res.status).toBe(200);
    expect((await res.json() as any).accepted).toBe(1);

    // Verify document is gone
    const row = sql!.prepare("SELECT id FROM documents WHERE id = ?").get("doc-del");
    expect(row).toBeUndefined();

    // Verify tombstone was created
    const ts = sql!.prepare(
      "SELECT * FROM sync_tombstones WHERE table_name = ? AND row_id = ?"
    ).get("documents", "doc-del");
    expect(ts).toBeDefined();
  });

  it("handles camelCase to snake_case conversion (camelCase columns from clients)", async () => {
    const now = new Date().toISOString();
    // Client sends camelCase keys; sync route converts to snake_case
    await app.request("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changes: {
          documents: {
            saves: [{
              id: "doc-camel",
              title: "Camel Test",
              originalName: "test.pdf",     // → original_name
              totalPages: 5,                // → total_pages
              folderId: null,               // → folder_id
              sortOrder: 0,                 // → sort_order
              createdAt: now,               // → created_at
              updatedAt: now,               // → updated_at
            }],
          },
        },
      }),
    });

    const sql = getSqlite();
    const row = sql!.prepare("SELECT * FROM documents WHERE id = ?").get("doc-camel") as any;
    expect(row).toBeDefined();
    expect(row.title).toBe("Camel Test");
    expect(row.original_name).toBe("test.pdf");
    expect(row.total_pages).toBe(5);
  });
});

describe("POST /api/sync/pull", () => {
  let tmpDir: string;
  let app: Hono<{ Variables: Variables }>;

  beforeEach(async () => {
    vi.resetModules();
    const [dbMod, syncMod] = await Promise.all([
      import("../db/index"),
      import("../routes/sync"),
    ]);
    initDatabase = dbMod.initDatabase;
    getDb = dbMod.getDb;
    getSqlite = dbMod.getSqlite;
    syncRoutes = syncMod.syncRoutes;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "siltflow-sync-pull-"));
    initDatabase({
      port: 3001, dataDir: tmpDir, tombstoneRetentionDays: 30,
      bootstrapToken: undefined,
    });

    app = setupApp(tmpDir);
  });

  afterEach(() => {
    const sql = getSqlite();
    if (sql) sql.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an empty pull when nothing changed", async () => {
    const res = await app.request("/api/sync/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastSyncAt: new Date().toISOString() }),
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.changes).toEqual({});
    expect(body.tombstones).toEqual([]);
    expect(body.serverTime).toBeDefined();
  });

  it("pulls changes after lastSyncAt", async () => {
    const pastTime = "2020-01-01T00:00:00Z";

    // Insert a document with a recent timestamp
    const sql = getSqlite();
    const now = new Date().toISOString();
    sql!.prepare(`
      INSERT INTO documents (id, title, created_at, updated_at, sort_order)
      VALUES (?, ?, ?, ?, 0)
    `).run("doc-pull", "Pullable Doc", now, now);

    const res = await app.request("/api/sync/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastSyncAt: pastTime }),
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.changes.documents).toBeDefined();
    expect(body.changes.documents.length).toBeGreaterThanOrEqual(1);
    expect(body.changes.documents[0].id).toBe("doc-pull");
  });

  it("returns tombstone changes", async () => {
    const sql = getSqlite();
    const now = new Date().toISOString();

    // Insert a document then create a tombstone
    sql!.prepare(`
      INSERT INTO documents (id, title, created_at, updated_at, sort_order)
      VALUES (?, ?, ?, ?, 0)
    `).run("doc-ts", "Tombstoned Doc", now, now);

    sql!.prepare(`
      INSERT INTO sync_tombstones (table_name, row_id, deleted_at)
      VALUES ('documents', 'doc-ts', ?)
    `).run(now);

    const pastTime = "2020-01-01T00:00:00Z";
    const res = await app.request("/api/sync/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastSyncAt: pastTime }),
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.tombstones.length).toBeGreaterThanOrEqual(1);
    expect(body.tombstones[0].table_name).toBe("documents");
    expect(body.tombstones[0].row_id).toBe("doc-ts");
  });

  it("returns serverTime as ISO timestamp", async () => {
    const res = await app.request("/api/sync/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastSyncAt: "2020-01-01T00:00:00Z" }),
    });
    const body = await res.json() as any;
    expect(() => new Date(body.serverTime)).not.toThrow();
    expect(new Date(body.serverTime).getTime()).toBeGreaterThan(0);
  });
});
