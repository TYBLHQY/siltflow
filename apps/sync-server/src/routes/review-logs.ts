/**
 * Review log routes — insert-only (append log), query, and delete.
 *
 * Endpoints:
 *   GET    /api/annotations/:id/review-logs  List by annotation
 *   GET    /api/review-logs                   List all
 *   POST   /api/review-logs                   Insert new
 *   DELETE /api/annotations/:id/review-logs   Delete by annotation
 */

import { Hono } from "hono";
import { getSqlite } from "../db";
import { randomBytes } from "node:crypto";
import type { Variables } from "../types";

function uuid() { return randomBytes(16).toString("hex"); }

export const reviewLogRoutes = new Hono<{ Variables: Variables }>()
  .get("/annotations/:id/review-logs", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const annotationId = c.req.param("id");
    const documentId = c.req.query("documentId");
    if (!documentId) return c.json({ error: "documentId query param required" }, 400);
    const rows = sql.prepare(
      "SELECT id, annotation_id, document_id, data, created_at FROM review_logs WHERE annotation_id = ? AND document_id = ? ORDER BY created_at DESC"
    ).all(annotationId, documentId) as Record<string, unknown>[];
    return c.json(rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      annotationId: r.annotation_id,
      documentId: r.document_id,
      data: r.data,
      createdAt: r.created_at,
    })));
  })
  .get("/review-logs", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const rows = sql.prepare(
      "SELECT id, annotation_id, document_id, data, created_at FROM review_logs ORDER BY created_at ASC"
    ).all() as Record<string, unknown>[];
    return c.json(rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      annotationId: r.annotation_id,
      documentId: r.document_id,
      data: r.data,
      createdAt: r.created_at,
    })));
  })
  .post("/review-logs", async (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{
      annotationId: string; documentId: string; data: unknown;
    }>();
    const now = new Date().toISOString();
    const id = uuid();
    sql.prepare(
      "INSERT INTO review_logs (id, annotation_id, document_id, data, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(id, body.annotationId, body.documentId,
      typeof body.data === "string" ? body.data : JSON.stringify(body.data), now);
    return c.json({ id, createdAt: now }, 201);
  })
  .delete("/annotations/:id/review-logs", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const annotationId = c.req.param("id");
    const documentId = c.req.query("documentId");
    if (!documentId) return c.json({ error: "documentId query param required" }, 400);
    sql.prepare(
      "DELETE FROM review_logs WHERE annotation_id = ? AND document_id = ?"
    ).run(annotationId, documentId);
    return c.json({ ok: true });
  });
