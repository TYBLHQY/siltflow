/**
 * PDF file storage — upload, download, delete.
 *
 * Uses LocalFileStorage (fs-based). The FileStorage interface allows
 * swapping to cloud storage later without changing route code.
 *
 * Endpoints:
 *   POST   /api/files/upload       Multipart form: file (PDF) + documentId field
 *   GET    /api/files/:documentId  Download stored PDF
 *   DELETE /api/files/:documentId  Delete stored PDF
 */

import { Hono } from "hono";
import type { Variables } from "../types";
import { LocalFileStorage } from "../storage/local";

export function createFileRoutes(dataDir: string) {
  const storage = new LocalFileStorage(dataDir);

  return new Hono<{ Variables: Variables }>()
    .post("/files/upload", async (c) => {
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
