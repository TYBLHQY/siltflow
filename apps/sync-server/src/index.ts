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

// Resolve bootstrap token: env var wins, otherwise persist a generated one
const config = resolveBootstrapToken(envConfig);

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

  // Run every hour as safety net for devices that pull but don't trigger
  // cleanup naturally (e.g. single-device scenario where Pull marks ack
  // but there's no other device to trigger the next Pull)
  setInterval(run, 60 * 60 * 1000);
  // Also run once on startup
  run();
}

// ── Bootstrap token persistence ───────────────────────────────────────

/**
 * Ensure a bootstrap token exists in server_settings for admin use,
 * but do NOT inject it into runtime config unless BOOTSTRAP_TOKEN
 * was explicitly set via environment variable.
 *
 * Only an explicit BOOTSTRAP_TOKEN env var gatekeeps /api/auth/bootstrap.
 * The persisted token in server_settings is informational — it lets the
 * operator (or dashboard) copy it without digging through env vars.
 *
 *   1. BOOTSTRAP_TOKEN env var → inject into config (auth required).
 *   2. Otherwise, ensure a token exists in server_settings (auto-generate
 *      on first start) but leave config.bootstrapToken undefined so
 *      bootstrap remains open.
 */
function resolveBootstrapToken(config: ServerConfig): ServerConfig {
  if (config.bootstrapToken) {
    console.log("[sync-server] Using BOOTSTRAP_TOKEN from environment");
    return config;
  }

  const sql = getSqlite();
  if (!sql) {
    console.warn("[sync-server] DB not ready, skipping bootstrap token resolution");
    return config;
  }

  // Ensure a token exists in server_settings (first-start generation)
  let row = sql
    .prepare("SELECT value FROM server_settings WHERE key = ?")
    .get("bootstrap_token") as { value: string } | undefined;

  if (!row) {
    const token = randomBytes(32).toString("hex");
    const now = new Date().toISOString();
    sql
      .prepare("INSERT INTO server_settings (key, value, updated_at) VALUES (?, ?, ?)")
      .run("bootstrap_token", token, now);
    row = { value: token };
    console.log(`[sync-server] Bootstrap token (auto-generated, persisted): ${token}`);
  } else {
    console.log("[sync-server] Bootstrap token loaded from settings (persisted)");
  }

  console.log(
    "[sync-server] To require auth for bootstrap, set env BOOTSTRAP_TOKEN.\n" +
      `  Current token: ${row.value}`
  );

  // Do NOT inject into config — only an explicit env var gates bootstrap.
  return config;
}
