/**
 * CRUD routes for folders — mirrors desktop IPC folders.ipc.ts.
 *
 * Endpoints:
 *   GET    /api/folders               List all
 *   POST   /api/folders               Create
 *   PATCH  /api/folders/:id            Rename
 *   DELETE /api/folders/:id            Recursive delete
 *   PATCH  /api/folders/move-documents Move documents between folders
 *   PATCH  /api/folders/:id/move       Move folder to new parent
 *   PATCH  /api/folders/sort-order     Bulk reorder
 */

import { Hono } from "hono";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { folders, documents } from "../db/schema";
import { randomBytes } from "node:crypto";
import type { Variables } from "../types";

function uuid() {
  return randomBytes(16).toString("hex");
}

/** Collect all descendant folder IDs recursively. */
function collectDescendantFolderIds(
  db: ReturnType<typeof getDb>,
  folderId: string,
): string[] {
  if (!db) return [];
  const children = db.select({ id: folders.id })
    .from(folders)
    .where(eq(folders.parentId, folderId))
    .all();
  const ids = children.map((c) => c.id);
  for (const childId of ids) {
    ids.push(...collectDescendantFolderIds(db, childId));
  }
  return ids;
}

export const folderRoutes = new Hono<{ Variables: Variables }>()
  // ── List all ────────────────────────────────────────────────────
  .get("/", (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    return c.json(db.select().from(folders).orderBy(folders.sortOrder).all());
  })
  // ── Create ──────────────────────────────────────────────────────
  .post("/", async (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{ name: string; parentId?: string | null }>();
    if (!body.name) return c.json({ error: "name is required" }, 400);
    const now = new Date().toISOString();
    const id = uuid();
    db.insert(folders)
      .values({
        id,
        name: body.name,
        parentId: body.parentId ?? null,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const row = db.select().from(folders).where(eq(folders.id, id)).get();
    c.var.ctx.wsHub.broadcast("sync:available", {
      entity: "folders", action: "created", id, timestamp: now,
      changedBy: c.var.deviceId,
    });
    return c.json(row, 201);
  })
  // ── Rename ──────────────────────────────────────────────────────
  .patch("/:id", async (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{ name: string }>();
    if (!body.name) return c.json({ error: "name is required" }, 400);
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.update(folders).set({ name: body.name, updatedAt: now } as any)
      .where(eq(folders.id, c.req.param("id"))).run();
    return c.json({ ok: true });
  })
  // ── Recursive delete ────────────────────────────────────────────
  .delete("/:id", (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const id = c.req.param("id");
    const allFolderIds = [id, ...collectDescendantFolderIds(db, id)];

    // Find all documents in these folders
    const docsToDelete = db
      .select({ id: documents.id })
      .from(documents)
      .where(inArray(documents.folderId, allFolderIds))
      .all();

    // Delete child folders, then parent folder
    for (const fid of allFolderIds.reverse()) {
      db.delete(folders).where(eq(folders.id, fid)).run();
    }

    // Delete affected documents (CASCADE handles children)
    for (const doc of docsToDelete) {
      db.delete(documents).where(eq(documents.id, doc.id)).run();
    }

    c.var.ctx.wsHub.broadcast("sync:available", {
      entity: "folders", action: "deleted", id,
      timestamp: new Date().toISOString(), changedBy: c.var.deviceId,
    });
    return c.json({ ok: true, deletedFolders: allFolderIds.length, deletedDocuments: docsToDelete.length });
  })
  // ── Move documents to folder ────────────────────────────────────
  .patch("/move-documents", async (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{ docIds: string[]; targetFolderId: string | null }>();
    if (!body.docIds?.length) return c.json({ error: "docIds is required" }, 400);
    const now = new Date().toISOString();
    for (const docId of body.docIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db.update(documents).set({ folderId: body.targetFolderId, updatedAt: now } as any)
        .where(eq(documents.id, docId)).run();
    }
    return c.json({ ok: true, count: body.docIds.length });
  })
  // ── Move folder to new parent ───────────────────────────────────
  .patch("/:id/move", async (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{ targetParentId: string | null }>();
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.update(folders).set({ parentId: body.targetParentId, updatedAt: now } as any)
      .where(eq(folders.id, c.req.param("id"))).run();
    return c.json({ ok: true });
  })
  // ── Bulk sort order ─────────────────────────────────────────────
  .patch("/sort-order", async (c) => {
    const db = getDb();
    if (!db) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{ items: { id: string; sortOrder: number }[] }>();
    if (!body.items?.length) return c.json({ error: "items array is required" }, 400);
    const now = new Date().toISOString();
    for (const { id, sortOrder } of body.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db.update(folders).set({ sortOrder, updatedAt: now } as any)
        .where(eq(folders.id, id)).run();
    }
    return c.json({ ok: true, count: body.items.length });
  });
