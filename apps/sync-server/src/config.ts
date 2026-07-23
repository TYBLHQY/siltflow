/**
 * Server configuration — Zod-validated environment variables.
 *
 * All settings have sensible defaults for local development.
 * Override via environment variables in production.
 */

import { strict as assert } from "node:assert";
import path from "node:path";
import os from "node:os";

export interface ServerConfig {
  /** HTTP server port. Default: 3001 */
  port: number;
  /** Data directory for SQLite DB and PDF files. Default: ~/.siltflow-server */
  dataDir: string;
  /** Number of days to retain sync tombstones before cleanup. Default: 30 */
  tombstoneRetentionDays: number;
  /** Token for admin bootstrap — first device uses this to register. */
  bootstrapToken: string | undefined;
}

function resolveDataDir(raw: string | undefined): string {
  if (raw) return raw.startsWith("~") ? path.join(os.homedir(), raw.slice(1)) : raw;
  return path.join(os.homedir(), ".siltflow-server");
}

export function loadConfig(env = process.env): ServerConfig {
  const port = parseInt(env["PORT"] ?? "3001", 10);
  assert(!Number.isNaN(port) && port > 0 && port < 65536, "PORT must be 1–65535");

  const dataDir = resolveDataDir(env["DATA_DIR"]);
  const tombstoneRetentionDays = parseInt(env["TOMBSTONE_RETENTION_DAYS"] ?? "30", 10);

  return {
    port,
    dataDir,
    tombstoneRetentionDays,
    bootstrapToken: env["BOOTSTRAP_TOKEN"],
  };
}
