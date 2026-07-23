/**
 * Server entry point.
 *
 * Creates the app, initialises the database, attaches WebSocket,
 * and starts the HTTP server.
 */

import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { initDatabase, getDb, getSqlite } from "./db";
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
