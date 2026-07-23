/**
 * Summary CRUD — one summary per document (document_id is primary key).
 *
 * Endpoints:
 *   GET    /api/summaries               List all
 *   GET    /api/documents/:id/summary   Get by document
 *   PUT    /api/documents/:id/summary   Upsert
 *   DELETE /api/documents/:id/summary   Delete
 */

import { Hono } from "hono";
import { getSqlite } from "../db";
import type { Variables } from "../types";

export const summaryRoutes = new Hono<{ Variables: Variables }>()
  .get("/summaries", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const rows = sql.prepare(
      "SELECT document_id, text, is_ai_generated, source_lang, created_at, updated_at FROM summaries"
    ).all() as Record<string, unknown>[];
    return c.json(rows.map((r: Record<string, unknown>) => ({
      documentId: r.document_id,
      text: r.text,
      isAiGenerated: !!r.is_ai_generated,
      sourceLang: r.source_lang,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })));
  })
  .get("/documents/:id/summary", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const row = sql.prepare(
      "SELECT document_id, text, is_ai_generated, source_lang, created_at, updated_at FROM summaries WHERE document_id = ?"
    ).get(c.req.param("id")) as Record<string, unknown> | undefined;
    if (!row) return c.json(null);
    return c.json({
      documentId: row.document_id,
      text: row.text,
      isAiGenerated: !!row.is_ai_generated,
      sourceLang: row.source_lang,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  })
  .put("/documents/:id/summary", async (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{
      text: string; isAiGenerated?: boolean; sourceLang?: string | null;
    }>();
    const documentId = c.req.param("id");
    const now = new Date().toISOString();
    sql.prepare(
      `INSERT OR REPLACE INTO summaries (document_id, text, is_ai_generated, source_lang, created_at, updated_at)
       VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM summaries WHERE document_id = ?), ?), ?)`
    ).run(documentId, body.text, body.isAiGenerated ? 1 : 0,
      body.sourceLang ?? null, documentId, now, now);
    return c.json({ documentId });
  })
  .delete("/documents/:id/summary", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    sql.prepare("DELETE FROM summaries WHERE document_id = ?")
      .run(c.req.param("id"));
    return c.json({ ok: true });
  });
