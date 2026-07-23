/**
 * Server entry point.
 *
 * Creates the app, initialises the database, attaches WebSocket,
 * and starts the HTTP server.
 */

import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { initDatabase, getDb } from "./db";
import { createWsHub } from "./ws";

// ── Bootstrap ─────────────────────────────────────────────────────────

const config = loadConfig();

console.log(`[sync-server] Starting with config:
  PORT=${config.port}
  DATA_DIR=${config.dataDir}
  TOMBSTONE_RETENTION_DAYS=${config.tombstoneRetentionDays}
`);

// Init database (creates dir + all tables + runs migrations)
initDatabase(config);
console.log("[sync-server] Database initialised");

// Create WebSocket hub
const wsHub = createWsHub();

// Build Hono app
const app = createApp(config, {
  getDb,
  wsHub,
});

// Start
const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[sync-server] Listening on http://localhost:${info.port}`);
  console.log(`[sync-server] Health: http://localhost:${info.port}/health`);
});

// Attach WebSocket to the same HTTP server
wsHub.attach(server as unknown as import("node:http").Server);
