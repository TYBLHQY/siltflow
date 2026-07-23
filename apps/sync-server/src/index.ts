/**
 * Server entry point.
 *
 * Creates the app, initialises the database, attaches WebSocket,
 * and starts the HTTP server.
 */

import { serve } from "@hono/node-server";
import { randomBytes } from "node:crypto";
import { createApp } from "./app";
import { loadConfig, type ServerConfig } from "./config";
import { initDatabase, getDb, getSqlite } from "./db";
import { createWsHub } from "./ws";

// ── Bootstrap ─────────────────────────────────────────────────────────

const envConfig = loadConfig();

// Init database (creates dir + all tables + runs migrations)
initDatabase(envConfig);
console.log("[sync-server] Database initialised");

// Resolve server token: env var > persisted > auto-generate
const config = resolveServerToken(envConfig);

console.log(`[sync-server] Starting with config:
  PORT=${config.port}
  DATA_DIR=${config.dataDir}
  TOMBSTONE_RETENTION_DAYS=${config.tombstoneRetentionDays}
`);

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

// ── Scheduled cleanup ───────────────────────────────────────────────────

startTombstoneCleanup(config);

console.log(
  `[sync-server] Tombstone cleanup: device-ack based + ${config.tombstoneRetentionDays}d fallback`,
);

// ── Tombstone cleanup (time-based safety net) ───────────────────────────

function startTombstoneCleanup(config: import("./config").ServerConfig) {
  const run = () => {
    const sql = getSqlite();
    if (!sql) return;
    const result = sql
      .prepare(
        `DELETE FROM sync_tombstones
         WHERE deleted_at < datetime('now', ? || ' days')
           AND id IN (
             SELECT t.id FROM sync_tombstones t
             WHERE NOT EXISTS (
               SELECT 1 FROM devices d
               WHERE NOT EXISTS (
                 SELECT 1 FROM sync_tombstone_acks a
                 WHERE a.tombstone_id = t.id AND a.device_id = d.id
               )
             )
           )`,
      )
      .run(String(-config.tombstoneRetentionDays));
    if (result.changes > 0) {
      console.log(
        `[sync-server] Tombstone cleanup: removed ${result.changes} expired records`,
      );
    }
  };

  setInterval(run, 60 * 60 * 1000);
  run();
}

// ── Server token ──────────────────────────────────────────────────────

/**
 * Resolve the server token at startup.
 *
 * This token is the **server-level** secret that clients must present
 * to register a new device. It is NOT a device token — it proves the
 * client has permission to join this server.
 *
 *   1. `SERVER_TOKEN` env var → inject into config (production).
 *   2. Otherwise load from `server_settings` (persisted across restarts).
 *   3. If neither exists, auto-generate and persist.
 *
 * The token is always injected into config so /api/auth/register
 * requires it. Log it at startup so the operator can copy it.
 */
function resolveServerToken(config: ServerConfig): ServerConfig {
  if (config.bootstrapToken) {
    // Legacy: BOOTSTRAP_TOKEN env var maps to serverToken
    console.log("[sync-server] Using server token from SERVER_TOKEN / BOOTSTRAP_TOKEN env");
    return config;
  }

  const sql = getSqlite();
  if (!sql) {
    console.warn("[sync-server] DB not ready, skipping server token resolution");
    return config;
  }

  let row = sql
    .prepare("SELECT value FROM server_settings WHERE key = ?")
    .get("server_token") as { value: string } | undefined;

  if (row) {
    console.log("[sync-server] Server token loaded from settings");
    return { ...config, bootstrapToken: row.value };
  }

  // First start — generate and persist
  const token = randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  sql
    .prepare("INSERT INTO server_settings (key, value, updated_at) VALUES (?, ?, ?)")
    .run("server_token", token, now);

  console.log(`[sync-server] Server token (auto-generated, persisted):
  ${token}

  Share this token with devices that need to join this server.
  Set SERVER_TOKEN env var to override (won't be read from settings).
`);

  return { ...config, bootstrapToken: token };
}
