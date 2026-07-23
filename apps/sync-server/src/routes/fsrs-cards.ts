/**
 * CRUD routes for FSRS cards.
 *
 * Endpoints:
 *   GET    /api/annotations/:id/fsrs-card    Get by annotation
 *   GET    /api/documents/:id/fsrs-cards     List by document
 *   GET    /api/fsrs-cards                   List all
 *   PUT    /api/annotations/:id/fsrs-card    Upsert
 *   DELETE /api/annotations/:id/fsrs-card    Delete
 */

import { Hono } from "hono";
import { getSqlite } from "../db";
import type { Variables } from "../types";

export const fsrsCardRoutes = new Hono<{ Variables: Variables }>()
  .get("/annotations/:id/fsrs-card", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const annotationId = c.req.param("id");
    const documentId = c.req.query("documentId");
    if (!documentId) return c.json({ error: "documentId query param required" }, 400);
    const row = sql.prepare(
      "SELECT data FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?"
    ).get(annotationId, documentId) as { data: string | null } | undefined;
    return c.json(row?.data ?? null);
  })
  .get("/documents/:id/fsrs-cards", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const rows = sql.prepare(
      "SELECT annotation_id, data FROM fsrs_cards WHERE document_id = ?"
    ).all(c.req.param("id")) as { annotation_id: string; data: string }[];
    return c.json(rows.map((r) => ({ annotationId: r.annotation_id, data: r.data })));
  })
  .get("/fsrs-cards", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const rows = sql.prepare(
      "SELECT annotation_id, document_id, data, created_at, updated_at FROM fsrs_cards"
    ).all() as Record<string, unknown>[];
    return c.json(rows.map((r: Record<string, unknown>) => ({
      annotationId: r.annotation_id,
      documentId: r.document_id,
      data: r.data,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })));
  })
  .put("/annotations/:id/fsrs-card", async (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{
      documentId: string; data: unknown;
    }>();
    const annotationId = c.req.param("id");
    const now = new Date().toISOString();
    sql.prepare(
      `INSERT OR REPLACE INTO fsrs_cards (annotation_id, document_id, data, created_at, updated_at)
       VALUES (?, ?, ?, COALESCE((SELECT created_at FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?), ?), ?)`
    ).run(
      annotationId, body.documentId,
      typeof body.data === "string" ? body.data : JSON.stringify(body.data),
      annotationId, body.documentId, now, now,
    );
    return c.json({ annotationId });
  })
  .delete("/annotations/:id/fsrs-card", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const annotationId = c.req.param("id");
    const documentId = c.req.query("documentId");
    if (!documentId) return c.json({ error: "documentId query param required" }, 400);
    sql.prepare("DELETE FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?")
      .run(annotationId, documentId);
    return c.json({ ok: true });
  });
