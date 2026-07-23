/**
 * Static file server for the dashboard SPA.
 *
 * Serves files from dist-dashboard/ with SPA fallback:
 *   - API/health/ws paths are skipped
 *   - Existing files are served with correct MIME types
 *   - Non-existent paths fall back to index.html (for client-side routing)
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Context } from "hono";

const DASHBOARD_DIR = path.resolve(import.meta.dirname, "../dist-dashboard");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

export function serveDashboard(c: Context) {
  const urlPath = c.req.path;

  // Let API, health, and WebSocket routes through
  if (urlPath.startsWith("/api") || urlPath.startsWith("/health") || urlPath === "/ws") {
    return c.notFound();
  }

  // Resolve file path
  let filePath: string;
  if (urlPath === "/" || urlPath === "") {
    filePath = path.join(DASHBOARD_DIR, "index.html");
  } else {
    filePath = path.join(DASHBOARD_DIR, urlPath.slice(1)); // strip leading /
  }

  // SPA fallback: if file doesn't exist, serve index.html
  if (!existsSync(filePath)) {
    filePath = path.join(DASHBOARD_DIR, "index.html");
  }

  // Guard: don't escape the dashboard dir
  if (!filePath.startsWith(DASHBOARD_DIR)) {
    return c.notFound();
  }

  try {
    const content = readFileSync(filePath);
    const ext = path.extname(filePath);
    return new Response(content, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
      },
    });
  } catch {
    return c.notFound();
  }
}
