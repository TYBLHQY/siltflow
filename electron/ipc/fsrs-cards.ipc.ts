import { ipcMain } from "electron";
import { getSqlite } from "../database";
import { invalidateReviewMetricsCache } from "./review.ipc";

export function registerFSRSCardHandlers() {
  ipcMain.handle(
    "fsrsCards:get",
    (_event, annotationId: string, documentId: string) => {
      const sql = getSqlite();
      if (!sql) return null;

      const row = sql
        .prepare(
          "SELECT data FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?",
        )
        .get(annotationId, documentId) as Record<string, unknown> | undefined;
      return (row?.data as string) ?? null;
    },
  );

  ipcMain.handle("fsrsCards:listByDocument", (_event, documentId: string) => {
    const sql = getSqlite();
    if (!sql) return [];

    const rows = sql
      .prepare(
        "SELECT annotation_id, data FROM fsrs_cards WHERE document_id = ?",
      )
      .all(documentId) as Record<string, unknown>[];
    return rows.map((r) => ({
      annotationId: r.annotation_id as string,
      data: r.data as string,
    }));
  });

  ipcMain.handle("fsrsCards:listAll", () => {
    const sql = getSqlite();
    if (!sql) return [];

    const rows = sql
      .prepare(
        "SELECT annotation_id, document_id, data, created_at, updated_at FROM fsrs_cards",
      )
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({
      annotationId: r.annotation_id as string,
      documentId: r.document_id as string,
      data: r.data as string,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));
  });

  ipcMain.handle(
    "fsrsCards:save",
    (
      _event,
      record: { annotationId: string; documentId: string; data: unknown },
    ) => {
      const sql = getSqlite();
      if (!sql) return null;
      const now = new Date().toISOString();
      sql
        .prepare(
          `INSERT OR REPLACE INTO fsrs_cards (annotation_id, document_id, data, created_at, updated_at)
       VALUES (?, ?, ?, COALESCE((SELECT created_at FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?), ?), ?)`,
        )
        .run(
          record.annotationId,
          record.documentId,
          JSON.stringify(record.data),
          record.annotationId,
          record.documentId,
          now,
          now,
        );
      invalidateReviewMetricsCache();
      return { annotationId: record.annotationId };
    },
  );

  ipcMain.handle(
    "fsrsCards:delete",
    (_event, annotationId: string, documentId: string) => {
      const sql = getSqlite();
      if (!sql) return;
      sql
        .prepare(
          "DELETE FROM fsrs_cards WHERE annotation_id = ? AND document_id = ?",
        )
        .run(annotationId, documentId);
      invalidateReviewMetricsCache();
    },
  );
}
