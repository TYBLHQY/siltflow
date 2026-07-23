/**
 * PDF file storage — upload, download, delete.
 *
 * Uses LocalFileStorage (fs-based). The FileStorage interface allows
 * swapping to cloud storage later without changing route code.
 *
 * PDF upload can be disabled via the server_settings.pdf_sync_enabled toggle.
 * This lets admins conserve storage/bandwidth when large PDF sync isn't needed.
 *
 * Endpoints:
 *   POST   /api/files/upload       Multipart form: file (PDF) + documentId field
 *   GET    /api/files/:documentId  Download stored PDF
 *   DELETE /api/files/:documentId  Delete stored PDF
 */

import { Hono } from "hono";
import type { Variables } from "../types";
import { LocalFileStorage } from "../storage/local";
import { getSqlite } from "../db";

export function createFileRoutes(dataDir: string) {
  const storage = new LocalFileStorage(dataDir);

  return new Hono<{ Variables: Variables }>()
    .post("/files/upload", async (c) => {
      // Honor PDF sync toggle
      const sql = getSqlite();
      if (sql) {
        const row = sql.prepare(
          "SELECT value FROM server_settings WHERE key = 'pdf_sync_enabled'"
        ).get() as { value: string } | undefined;
        if (row && row.value === "false") {
          return c.json(
            { error: "PDF upload is currently disabled", code: "PDF_SYNC_DISABLED" },
            403,
          );
        }
      }

      const body = await c.req.parseBody();
      const file = body["file"] as File | undefined;
      const documentId = body["documentId"] as string | undefined;

      if (!file || !documentId) {
        return c.json({ error: "file and documentId are required" }, 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      await storage.upload(documentId, buffer);

      return c.json({ ok: true, documentId, size: buffer.length }, 201);
    })
    .get("/files/:documentId", async (c) => {
      const documentId = c.req.param("documentId");
      const buffer = await storage.download(documentId);
      if (!buffer) return c.json({ error: "not found" }, 404);

      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(buffer.length),
          "Accept-Ranges": "bytes",
        },
      });
    })
    .delete("/files/:documentId", async (c) => {
      const documentId = c.req.param("documentId");
      await storage.delete(documentId);
      return c.json({ ok: true });
    });
}
