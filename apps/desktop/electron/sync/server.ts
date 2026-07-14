/**
 * Local HTTP sync server — runs inside Electron main process.
 * Serves the database over HTTP so the mobile app can pull/push data.
 *
 * Usage: Start from renderer via IPC: window.siltflow.sync.start(port)
 * Stop via: window.siltflow.sync.stop()
 */

import http from "node:http"
import { randomUUID } from "node:crypto"
import { getSqlite } from "../database"
import fs from "node:fs"
import path from "node:path"

let server: http.Server | null = null
let vaultPath = ""
let serverPort = 0

// ==========================================================================
// helpers
// ==========================================================================

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  })
  res.end(JSON.stringify(data))
}

function error(res: http.ServerResponse, msg: string, status = 400) {
  json(res, { error: msg }, status)
}

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()))
      } catch {
        reject(new Error("Invalid JSON"))
      }
    })
    req.on("error", reject)
  })
}

// ==========================================================================
// Handlers
// ==========================================================================

function handleState(res: http.ServerResponse) {
  const sql = getSqlite()
  if (!sql) return json(res, { state: "no-database" })

  json(res, {
    version: 1,
    serverTime: new Date().toISOString(),
    vaultPath,
  })
}

function handleDocuments(res: http.ServerResponse) {
  const sql = getSqlite()
  if (!sql) return error(res, "no database")
  const rows = sql
    .prepare(
      "SELECT id, title, original_name, total_pages, folder_id, sort_order, created_at, updated_at FROM documents ORDER BY sort_order, created_at",
    )
    .all()
  json(res, rows)
}

function handleDocumentPdf(
  res: http.ServerResponse,
  id: string,
) {
  if (!vaultPath) return error(res, "no vault")
  const pdfPath = path.join(vaultPath, "documents", `${id}.pdf`)
  if (!fs.existsSync(pdfPath)) return error(res, "pdf not found", 404)
  const stat = fs.statSync(pdfPath)
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Length": stat.size,
    "Access-Control-Allow-Origin": "*",
    "Content-Disposition": `attachment; filename="${id}.pdf"`,
  })
  fs.createReadStream(pdfPath).pipe(res)
}

function handleFolders(res: http.ServerResponse) {
  const sql = getSqlite()
  if (!sql) return error(res, "no database")
  const rows = sql
    .prepare(
      "SELECT id, name, parent_id, sort_order, created_at, updated_at FROM folders ORDER BY sort_order, name",
    )
    .all()
  json(res, rows)
}

function handleAnnotations(
  res: http.ServerResponse,
  url: URL,
) {
  const sql = getSqlite()
  if (!sql) return error(res, "no database")
  const docId = url.searchParams.get("document_id")
  let rows: any[]
  if (docId) {
    rows = sql
      .prepare(
        "SELECT id, document_id, type, text, page_number, embed_data, created_at, updated_at FROM annotations WHERE document_id = ? ORDER BY created_at",
      )
      .all(docId)
  } else {
    rows = sql
      .prepare(
        "SELECT id, document_id, type, text, page_number, embed_data, created_at, updated_at FROM annotations ORDER BY created_at",
      )
      .all()
  }
  json(res, rows)
}

function handleAiResults(res: http.ServerResponse) {
  const sql = getSqlite()
  if (!sql) return error(res, "no database")
  const rows = sql
    .prepare(
      "SELECT annotation_id, document_id, data, created_at, updated_at FROM ai_results ORDER BY updated_at",
    )
    .all()
  json(res, rows)
}

function handleFsrsCards(res: http.ServerResponse) {
  const sql = getSqlite()
  if (!sql) return error(res, "no database")
  const rows = sql
    .prepare(
      "SELECT annotation_id, document_id, data, created_at, updated_at FROM fsrs_cards ORDER BY updated_at",
    )
    .all()
  json(res, rows)
}

function handleReviewLogs(res: http.ServerResponse) {
  const sql = getSqlite()
  if (!sql) return error(res, "no database")
  const rows = sql
    .prepare(
      "SELECT id, annotation_id, document_id, data, created_at FROM review_logs ORDER BY created_at",
    )
    .all()
  json(res, rows)
}

function handleSummaries(res: http.ServerResponse) {
  const sql = getSqlite()
  if (!sql) return error(res, "no database")
  const rows = sql
    .prepare(
      "SELECT document_id, text, is_ai_generated, source_lang, created_at, updated_at FROM summaries ORDER BY updated_at",
    )
    .all()
  json(res, rows)
}

// ==========================================================================
// POST /api/sync/push — accept mobile changes
// ==========================================================================

async function handlePush(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const sql = getSqlite()
  if (!sql) return error(res, "no database")

  let body: any
  try {
    body = await parseBody(req)
  } catch {
    return error(res, "invalid JSON body")
  }

  const tx = sql.transaction(() => {
    // Push annotations (and related data)
    if (Array.isArray(body.annotations)) {
      for (const a of body.annotations) {
        sql
          .prepare(
            `INSERT OR REPLACE INTO annotations (id, document_id, type, text, page_number, embed_data, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            a.id,
            a.document_id,
            a.type || "highlight",
            a.text || "",
            a.page_number ?? 0,
            a.embed_data || "",
            a.created_at || new Date().toISOString(),
            a.updated_at || new Date().toISOString(),
          )
      }
    }

    // Push AI results
    if (Array.isArray(body.aiResults)) {
      for (const r of body.aiResults) {
        sql
          .prepare(
            `INSERT OR REPLACE INTO ai_results (annotation_id, document_id, data, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            r.annotation_id,
            r.document_id,
            r.data,
            r.created_at || new Date().toISOString(),
            r.updated_at || new Date().toISOString(),
          )
      }
    }

    // Push FSRS cards
    if (Array.isArray(body.fsrsCards)) {
      for (const c of body.fsrsCards) {
        sql
          .prepare(
            `INSERT OR REPLACE INTO fsrs_cards (annotation_id, document_id, data, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            c.annotation_id,
            c.document_id,
            c.data,
            c.created_at || new Date().toISOString(),
            c.updated_at || new Date().toISOString(),
          )
      }
    }

    // Push review logs
    if (Array.isArray(body.reviewLogs)) {
      for (const l of body.reviewLogs) {
        sql
          .prepare(
            `INSERT OR REPLACE INTO review_logs (id, annotation_id, document_id, data, created_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            l.id || randomUUID(),
            l.annotation_id,
            l.document_id,
            l.data,
            l.created_at || new Date().toISOString(),
          )
      }
    }

    // Push summaries
    if (Array.isArray(body.summaries)) {
      for (const s of body.summaries) {
        sql
          .prepare(
            `INSERT OR REPLACE INTO summaries (document_id, text, is_ai_generated, source_lang, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            s.document_id,
            s.text,
            s.is_ai_generated ?? 0,
            s.source_lang || null,
            s.created_at || new Date().toISOString(),
            s.updated_at || new Date().toISOString(),
          )
      }
    }
  })

  try {
    tx()
    json(res, { ok: true, pushed: Object.keys(body).length })
  } catch (err: any) {
    error(res, err.message, 500)
  }
}

// ==========================================================================
// Router
// ==========================================================================

function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    })
    res.end()
    return
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`)
  const parts = url.pathname.split("/").filter(Boolean)

  // GET /api/state
  if (req.method === "GET" && parts[0] === "api" && parts[1] === "state") {
    return handleState(res)
  }

  // GET /api/documents
  if (req.method === "GET" && parts[0] === "api" && parts[1] === "documents" && !parts[2]) {
    return handleDocuments(res)
  }

  // GET /api/documents/:id/pdf
  if (req.method === "GET" && parts[0] === "api" && parts[1] === "documents" && parts[2] === "pdf") {
    return handleDocumentPdf(res, parts[3])
  }

  // GET /api/folders
  if (req.method === "GET" && parts[0] === "api" && parts[1] === "folders") {
    return handleFolders(res)
  }

  // GET /api/annotations
  if (req.method === "GET" && parts[0] === "api" && parts[1] === "annotations") {
    return handleAnnotations(res, url)
  }

  // GET /api/ai-results
  if (req.method === "GET" && parts[0] === "api" && parts[1] === "ai-results") {
    return handleAiResults(res)
  }

  // GET /api/fsrs-cards
  if (req.method === "GET" && parts[0] === "api" && parts[1] === "fsrs-cards") {
    return handleFsrsCards(res)
  }

  // GET /api/review-logs
  if (req.method === "GET" && parts[0] === "api" && parts[1] === "review-logs") {
    return handleReviewLogs(res)
  }

  // GET /api/summaries
  if (req.method === "GET" && parts[0] === "api" && parts[1] === "summaries") {
    return handleSummaries(res)
  }

  // POST /api/sync/push
  if (req.method === "POST" && parts[0] === "api" && parts[1] === "sync" && parts[2] === "push") {
    return handlePush(req, res)
  }

  // Health check
  if (req.method === "GET" && url.pathname === "/") {
    return json(res, { status: "ok", app: "siltflow-sync", port: serverPort })
  }

  json(res, { error: "not found" }, 404)
}

// ==========================================================================
// Start / Stop
// ==========================================================================

export function startSyncServer(vPath: string, port = 53891): Promise<number> {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close()
      server = null
    }

    vaultPath = vPath

    server = http.createServer(handleRequest)
    server.listen(port, "0.0.0.0", () => {
      serverPort = (server!.address() as any).port
      console.log(`[sync] server started on port ${serverPort}`)
      resolve(serverPort)
    })
    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        // try next port
        server?.close()
        server = null
        startSyncServer(vPath, port + 1).then(resolve).catch(reject)
      } else {
        reject(err)
      }
    })
  })
}

export function stopSyncServer() {
  if (server) {
    server.close()
    server = null
    serverPort = 0
    console.log("[sync] server stopped")
  }
}

export function getSyncStatus(): { running: boolean; port: number } {
  return { running: server !== null, port: serverPort }
}
