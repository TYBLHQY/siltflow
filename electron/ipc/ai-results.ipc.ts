import { ipcMain } from "electron";
import { getSqlite, AI_DATA_VERSION } from "../database";

export function registerAiResultHandlers() {
  ipcMain.handle(
    "aiResults:get",
    (_event, annotationId: string, documentId: string) => {
      const sql = getSqlite();
      if (!sql) return null;

      const row = sql
        .prepare(
          "SELECT data FROM ai_results WHERE annotation_id = ? AND document_id = ?",
        )
        .get(annotationId, documentId) as Record<string, unknown> | undefined;
      return (row?.data as string) ?? null;
    },
  );

  ipcMain.handle("aiResults:listByDocument", (_event, documentId: string) => {
    const sql = getSqlite();
    if (!sql) return [];

    const rows = sql
      .prepare(
        "SELECT annotation_id, data FROM ai_results WHERE document_id = ?",
      )
      .all(documentId) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      annotationId: r.annotation_id as string,
      data: r.data as string,
    }));
  });

  ipcMain.handle(
    "aiResults:save",
    (
      _event,
      record: {
        annotationId: string;
        documentId: string;
        data: unknown;
        version?: number;
      },
    ) => {
      const sql = getSqlite();
      if (!sql) return null;
      const now = new Date().toISOString();
      sql
        .prepare(
          `INSERT OR REPLACE INTO ai_results (annotation_id, document_id, data, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM ai_results WHERE annotation_id = ? AND document_id = ?), ?), ?)`,
        )
        .run(
          record.annotationId,
          record.documentId,
          JSON.stringify(record.data),
          record.version ?? AI_DATA_VERSION,
          record.annotationId,
          record.documentId,
          now,
          now,
        );
      return { annotationId: record.annotationId };
    },
  );

  ipcMain.handle(
    "aiResults:delete",
    (_event, annotationId: string, documentId: string) => {
      const sql = getSqlite();
      if (!sql) return;
      sql
        .prepare(
          "DELETE FROM ai_results WHERE annotation_id = ? AND document_id = ?",
        )
        .run(annotationId, documentId);
    },
  );
}
