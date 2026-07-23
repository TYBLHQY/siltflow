/**
 * CRUD routes for AI results.
 *
 * Endpoints:
 *   GET    /api/annotations/:id/ai-result    Get by annotation
 *   GET    /api/documents/:id/ai-results     List by document
 *   PUT    /api/annotations/:id/ai-result    Upsert
 *   DELETE /api/annotations/:id/ai-result    Delete
 */

import { Hono } from "hono";
import { getSqlite } from "../db";
import type { Variables } from "../types";

export const aiResultRoutes = new Hono<{ Variables: Variables }>()
  .get("/annotations/:id/ai-result", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const annotationId = c.req.param("id");
    const documentId = c.req.query("documentId");
    if (!documentId) return c.json({ error: "documentId query param required" }, 400);
    const row = sql.prepare(
      "SELECT annotation_id, document_id, data, version, created_at, updated_at FROM ai_results WHERE annotation_id = ? AND document_id = ?"
    ).get(annotationId, documentId) as Record<string, unknown> | undefined;
    if (!row) return c.json(null);
    return c.json({
      annotationId: row.annotation_id,
      documentId: row.document_id,
      data: row.data,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  })
  .get("/documents/:id/ai-results", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const rows = sql.prepare(
      "SELECT annotation_id, data, version FROM ai_results WHERE document_id = ?"
    ).all(c.req.param("id")) as Record<string, unknown>[];
    return c.json(rows.map((r: Record<string, unknown>) => ({
      annotationId: r.annotation_id,
      data: r.data,
      version: r.version,
    })));
  })
  .put("/annotations/:id/ai-result", async (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{
      documentId: string; data: unknown; version?: number;
    }>();
    const annotationId = c.req.param("id");
    const now = new Date().toISOString();
    sql.prepare(
      `INSERT OR REPLACE INTO ai_results (annotation_id, document_id, data, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM ai_results WHERE annotation_id = ? AND document_id = ?), ?), ?)`
    ).run(
      annotationId, body.documentId, typeof body.data === "string" ? body.data : JSON.stringify(body.data),
      body.version ?? 1,
      annotationId, body.documentId, now, now,
    );
    return c.json({ annotationId, version: body.version ?? 1 });
  })
  .delete("/annotations/:id/ai-result", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const annotationId = c.req.param("id");
    const documentId = c.req.query("documentId");
    if (!documentId) return c.json({ error: "documentId query param required" }, 400);
    sql.prepare("DELETE FROM ai_results WHERE annotation_id = ? AND document_id = ?")
      .run(annotationId, documentId);
    return c.json({ ok: true });
  });
