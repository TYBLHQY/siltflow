import { ipcMain } from "electron";
import { getSqlite } from "../database";
import crypto from "node:crypto";

export function registerReviewLogHandlers() {
  ipcMain.handle(
    "reviewLogs:listByAnnotation",
    (_event, annotationId: string, documentId: string) => {
      const sql = getSqlite();
      if (!sql) return [];

      const rows = sql
        .prepare(
          "SELECT id, annotation_id, document_id, data, created_at FROM review_logs WHERE annotation_id = ? AND document_id = ? ORDER BY created_at DESC",
        )
        .all(annotationId, documentId) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        id: r.id as string,
        annotationId: r.annotation_id as string,
        documentId: r.document_id as string,
        data: r.data as string,
        createdAt: r.created_at as string,
      }));
    },
  );

  ipcMain.handle("reviewLogs:listAll", () => {
    const sql = getSqlite();
    if (!sql) return [];

    const rows = sql
      .prepare(
        "SELECT id, annotation_id, document_id, data, created_at FROM review_logs ORDER BY created_at ASC",
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      annotationId: r.annotation_id as string,
      documentId: r.document_id as string,
      data: r.data as string,
      createdAt: r.created_at as string,
    }));
  });

  ipcMain.handle(
    "reviewLogs:save",
    (
      _event,
      record: { annotationId: string; documentId: string; data: unknown },
    ) => {
      const sql = getSqlite();
      if (!sql) return null;
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      sql
        .prepare(
          `INSERT INTO review_logs (id, annotation_id, document_id, data, created_at) VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          record.annotationId,
          record.documentId,
          JSON.stringify(record.data),
          now,
        );
      return { id, createdAt: now };
    },
  );

  ipcMain.handle(
    "reviewLogs:deleteByAnnotation",
    (_event, annotationId: string, documentId: string) => {
      const sql = getSqlite();
      if (!sql) return;
      sql
        .prepare(
          "DELETE FROM review_logs WHERE annotation_id = ? AND document_id = ?",
        )
        .run(annotationId, documentId);
    },
  );
}
