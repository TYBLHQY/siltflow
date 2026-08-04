import { ipcMain } from "electron";
import { getDb, getSqlite, schema } from "../database";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { invalidateReviewMetricsCache } from "./review.ipc";

let vaultPath = "";

export function setVaultPathForDocuments(p: string) {
  vaultPath = p;
}

export function registerDocumentHandlers() {
  ipcMain.handle("documents:list", () => {
    const db = getDb();
    if (!db) return [];
    return db.select().from(schema.documents).all();
  });

  ipcMain.handle("documents:get", (_event, id: string) => {
    const db = getDb();
    if (!db) return null;
    return db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, id))
      .get();
  });

  ipcMain.handle(
    "documents:save",
    (_event, doc: { id: string; title: string }) => {
      const db = getDb();
      if (!db) return null;
      const now = new Date().toISOString();
      const row = db
        .insert(schema.documents)
        .values({
          id: doc.id,
          title: doc.title,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
      // New document → the review metrics list (documents.id/title) changed.
      invalidateReviewMetricsCache();
      return row;
    },
  );
  ipcMain.handle("documents:delete", (_event, id: string) => {
    const db = getDb();
    if (!db) return;
    if (vaultPath) {
      const docPath = path.join(vaultPath, "documents", `${id}.pdf`);
      if (fs.existsSync(docPath)) {
        fs.rmSync(docPath, { force: true });
      }
    }
    db.delete(schema.documents).where(eq(schema.documents.id, id)).run();
    // Removed a document from the metrics list.
    invalidateReviewMetricsCache();
  });

  ipcMain.handle("documents:deleteBatch", (_event, ids: string[]) => {
    const db = getDb();
    if (!db) return;
    const sql = getSqlite();
    // Delete PDF files first (best-effort, can't be transactional) then the
    // DB rows in a single transaction so a failure can't leave a partially
    // removed document set behind.
    for (const id of ids) {
      if (vaultPath) {
        const docPath = path.join(vaultPath, "documents", `${id}.pdf`);
        if (fs.existsSync(docPath)) {
          fs.rmSync(docPath, { force: true });
        }
      }
    }
    if (sql && ids.length > 0) {
      sql.exec("BEGIN IMMEDIATE");
      try {
        for (const id of ids) {
          db.delete(schema.documents).where(eq(schema.documents.id, id)).run();
        }
        sql.exec("COMMIT");
      } catch (err) {
        sql.exec("ROLLBACK");
        throw err;
      }
    }
    // Batch removal changed the metrics document list.
    invalidateReviewMetricsCache();
  });

  ipcMain.handle(
    "documents:rename",
    (_event, { id, title }: { id: string; title: string }) => {
      const db = getDb();
      if (!db) return null;
      const now = new Date().toISOString();
      db.update(schema.documents)
        .set({ title, updatedAt: now })
        .where(eq(schema.documents.id, id))
        .run();
      // Title feeds the metrics list label — invalidate.
      invalidateReviewMetricsCache();
    },
  );

  ipcMain.handle(
    "documents:updateMetadata",
    (
      _event,
      {
        id,
        totalPages,
        metadata,
      }: { id: string; totalPages: number; metadata: string },
    ) => {
      const db = getDb();
      if (!db) return null;
      const now = new Date().toISOString();
      db.update(schema.documents)
        .set({ totalPages, metadata, updatedAt: now })
        .where(eq(schema.documents.id, id))
        .run();
    },
  );
}
