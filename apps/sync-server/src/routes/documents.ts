#!/usr/bin/env node
/**
 * CRUD routes for documents.
 *
 * Mirrors the desktop IPC handlers in apps/desktop/electron/ipc/documents.ipc.ts
 * and the mobile services in apps/mobile/src/services/documents.service.ts.
 *
 * Endpoints:
 *   GET    /api/documents               List all
 *   GET    /api/documents/:id           Get one
 *   POST   /api/documents               Create
 *   DELETE /api/documents/:id           Delete (also deletes stored PDF)
 *   POST   /api/documents/batch-delete  Bulk delete
 *   PATCH  /api/documents/:id           Rename or update metadata
 *   PATCH  /api/documents/sort-order    Bulk reorder
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { documents } from "../db/schema";
import { LocalFileStorage } from "../storage/local";
import type { Variables } from "../types";

export const documentRoutes = new Hono<{ Variables: Variables }>()
  // ── List all ────────────────────────────────────────────────────
  .get("/", (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const rows = db.select().from(documents).orderBy(documents.title).all();
    return c.json(rows);
  })
  // ── Get one ─────────────────────────────────────────────────────
  .get("/:id", (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const row = db
      .select()
      .from(documents)
      .where(eq(documents.id, c.req.param("id")))
      .get();
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json(row);
  })
  // ── Create ──────────────────────────────────────────────────────
  .post("/", async (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{ id: string; title: string }>();
    if (!body.id || !body.title) {
      return c.json({ error: "id and title are required" }, 400);
    }
    const now = new Date().toISOString();
    db.insert(documents)
      .values({ id: body.id, title: body.title, createdAt: now, updatedAt: now })
      .run();
    const row = db.select().from(documents).where(eq(documents.id, body.id)).get();
    c.var.ctx.wsHub.broadcast("sync:available", {
      entity: "documents",
      action: "created",
      id: body.id,
      timestamp: now,
      changedBy: c.var.deviceId,
    });
    return c.json(row, 201);
  })
  // ── Delete ──────────────────────────────────────────────────────
  .delete("/:id", async (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const id = c.req.param("id");
    db.delete(documents).where(eq(documents.id, id)).run();

    // Clean up stored PDF file (non-fatal if missing)
    const storage = new LocalFileStorage(c.var.config.dataDir);
    try { await storage.delete(id); } catch { /* already deleted — noop */ }

    c.var.ctx.wsHub.broadcast("sync:available", {
      entity: "documents",
      action: "deleted",
      id,
      timestamp: new Date().toISOString(),
      changedBy: c.var.deviceId,
    });
    return c.json({ ok: true });
  })
  // ── Bulk delete ─────────────────────────────────────────────────
  .post("/batch-delete", async (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{ ids: string[] }>();
    if (!body.ids?.length) {
      return c.json({ error: "ids array is required" }, 400);
    }
    const storage = new LocalFileStorage(c.var.config.dataDir);
    for (const id of body.ids) {
      db.delete(documents).where(eq(documents.id, id)).run();
      // Clean up stored PDF file (non-fatal if missing)
      try { await storage.delete(id); } catch { /* already deleted — noop */ }
    }
    c.var.ctx.wsHub.broadcast("sync:available", {
      entity: "documents",
      action: "batch-deleted",
      timestamp: new Date().toISOString(),
      changedBy: c.var.deviceId,
    });
    return c.json({ ok: true, count: body.ids.length });
  })
  // ── Rename ──────────────────────────────────────────────────────
  .patch("/:id", async (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const id = c.req.param("id");
    const body = await c.req.json<
      { title?: string; totalPages?: number; metadata?: string }
    >();
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updatedAt: now };
    if (body.title !== undefined) update.title = body.title;
    if (body.totalPages !== undefined) update.totalPages = body.totalPages;
    if (body.metadata !== undefined) update.metadata = body.metadata;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.update(documents).set(update as any).where(eq(documents.id, id)).run();
    const row = db.select().from(documents).where(eq(documents.id, id)).get();
    return c.json(row);
  })
  // ── Bulk sort order ─────────────────────────────────────────────
  .patch("/sort-order", async (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{ items: { id: string; sortOrder: number }[] }>();
    if (!body.items?.length) {
      return c.json({ error: "items array is required" }, 400);
    }
    const now = new Date().toISOString();
    for (const { id, sortOrder } of body.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db.update(documents).set({ sortOrder, updatedAt: now } as any)
        .where(eq(documents.id, id)).run();
    }
    return c.json({ ok: true, count: body.items.length });
  });
