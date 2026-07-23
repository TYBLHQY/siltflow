/**
 * CRUD routes for annotations — enriched with JOINs to ai_results + fsrs_cards.
 *
 * Endpoints:
 *   GET    /api/documents/:docId/annotations  List by document (enriched)
 *   GET    /api/annotations                    List all (enriched)
 *   PUT    /api/annotations/:id                Upsert
 *   DELETE /api/annotations/:id                Cascade delete (ai_results, fsrs_cards, review_logs)
 */

import { Hono } from "hono";
import { getDb, getSqlite } from "../db";
import { annotations, aiResults, fsrsCards } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Variables } from "../types";

// ── Enriched query ────────────────────────────────────────────────────

const ENRICHED_SQL = `
  SELECT
    a.id, a.document_id, a.type, a.text, a.page_number, a.embed_data,
    a.kind, a.created_at, a.updated_at,
    ar.data AS ai_data, ar.version AS ai_version,
    fc.data AS fsrs_data
  FROM annotations a
  LEFT JOIN ai_results ar ON ar.annotation_id = a.id AND ar.document_id = a.document_id
  LEFT JOIN fsrs_cards fc ON fc.annotation_id = a.id AND fc.document_id = a.document_id
`;

function tryParseJson(data: string | null, fallback: unknown) {
  if (!data) return fallback;
  try { return JSON.parse(data); } catch { return fallback; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEnriched(row: any) {
  return {
    id: row.id,
    document_id: row.document_id,
    type: row.type,
    text: row.text,
    page_number: row.page_number,
    embed_data: tryParseJson(row.embed_data, {}),
    kind: row.kind || "annotation",
    created_at: row.created_at,
    updated_at: row.updated_at,
    ai_data: tryParseJson(row.ai_data, null),
    ai_version: row.ai_version ?? null,
    fsrs_data: tryParseJson(row.fsrs_data, null),
  };
}

export const annotationRoutes = new Hono<{ Variables: Variables }>()
  // ── List by document ─────────────────────────────────────────────
  .get("/documents/:docId/annotations", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const docId = c.req.param("docId");
    const rows = sql.prepare(`${ENRICHED_SQL} WHERE a.document_id = ?`).all(docId) as any[];
    return c.json(rows.map(mapEnriched));
  })
  // ── List all ─────────────────────────────────────────────────────
  .get("/annotations", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const rows = sql.prepare(ENRICHED_SQL).all() as any[];
    return c.json(rows.map(mapEnriched));
  })
  // ── Upsert ───────────────────────────────────────────────────────
  .put("/annotations/:id", async (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const body = await c.req.json<{
      id: string; document_id: string; type: string;
      text?: string; page_number?: number; embed_data?: string;
      kind?: string;
    }>();
    const now = new Date().toISOString();
    sql.prepare(
      `INSERT OR REPLACE INTO annotations
       (id, document_id, type, text, page_number, embed_data, kind, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      body.id, body.document_id, body.type || "highlight",
      body.text || "", body.page_number ?? 0,
      body.embed_data || "", body.kind || "annotation",
      now, now,
    );
    c.var.ctx.wsHub.broadcast("sync:available", {
      entity: "annotations", action: "saved", id: body.id,
      timestamp: now, changedBy: c.var.deviceId,
    });
    return c.json({ id: body.id });
  })
  // ── Cascade delete ───────────────────────────────────────────────
  .delete("/annotations/:id", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);
    const annotationId = c.req.param("id");
    const documentId = c.req.query("documentId");
    if (!documentId) return c.json({ error: "documentId query param required" }, 400);

    sql.exec("BEGIN TRANSACTION");
    try {
      sql.prepare("DELETE FROM ai_results WHERE annotation_id = ? AND document_id = ?")
        .run(annotationId, documentId);
      sql.prepare("DELETE FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?")
        .run(annotationId, documentId);
      sql.prepare("DELETE FROM review_logs WHERE annotation_id = ? AND document_id = ?")
        .run(annotationId, documentId);
      sql.prepare("DELETE FROM annotations WHERE id = ? AND document_id = ?")
        .run(annotationId, documentId);
      sql.exec("COMMIT");
    } catch (err) {
      sql.exec("ROLLBACK");
      throw err;
    }
    c.var.ctx.wsHub.broadcast("sync:available", {
      entity: "annotations", action: "deleted", id: annotationId,
      timestamp: new Date().toISOString(), changedBy: c.var.deviceId,
    });
    return c.json({ ok: true });
  });
