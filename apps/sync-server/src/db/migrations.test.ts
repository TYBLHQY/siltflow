/**
 * Tests for server-side database migrations.
 *
 * Uses an in-memory SQLite database so tests are fast and isolated.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initServerSchema, SV_SCHEMA_VERSION } from "./migrations";
import { createBetterSqlite3Executor } from "@siltflow/shared-db/adapters/better-sqlite3";

function createExecutor(sqlite: Database.Database) {
  return createBetterSqlite3Executor(sqlite);
}

function freshDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

describe("initServerSchema", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = freshDb();
  });

  // ── Table creation ──────────────────────────────────────────────────

  it("creates the devices table", () => {
    const executor = createExecutor(sqlite);
    initServerSchema(executor, 0);

    const row = executor.get<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='devices'",
    );
    expect(row).toBeDefined();
  });

  it("creates the sync_tombstones table", () => {
    const executor = createExecutor(sqlite);
    initServerSchema(executor, 0);

    const row = executor.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_tombstones'",
    );
    expect(row).toBeDefined();
  });

  it("creates the sync_tombstone_acks table", () => {
    const executor = createExecutor(sqlite);
    initServerSchema(executor, 0);

    const row = executor.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_tombstone_acks'",
    );
    expect(row).toBeDefined();
  });

  it("creates the server_settings table", () => {
    const executor = createExecutor(sqlite);
    initServerSchema(executor, 0);

    const row = executor.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='server_settings'",
    );
    expect(row).toBeDefined();
  });

  // ── Idempotency ─────────────────────────────────────────────────────

  it("is idempotent — running twice does not error", () => {
    const executor = createExecutor(sqlite);
    initServerSchema(executor, 0);
    // Second call should succeed without throwing
    expect(() => initServerSchema(executor, 0)).not.toThrow();
  });

  it("does not recreate tables on second run", () => {
    const executor = createExecutor(sqlite);
    initServerSchema(executor, 0);

    // Insert a device to verify tables survive a second init
    executor.run(
      "INSERT INTO devices (id, name, token_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)",
      "dev-1", "test-device", "hash123", 0, new Date().toISOString(),
    );

    initServerSchema(executor, 0); // second run

    const device = executor.get<{ id: string }>(
      "SELECT id FROM devices WHERE id = 'dev-1'",
    );
    expect(device).toBeDefined();
  });

  // ── Version tracking ────────────────────────────────────────────────

  it("persists schema_version to server_settings after init", () => {
    const executor = createExecutor(sqlite);
    initServerSchema(executor, 0);

    const row = executor.get<{ value: string }>(
      "SELECT value FROM server_settings WHERE key = 'schema_version'",
    );
    expect(row).toBeDefined();
    expect(parseInt(row!.value, 10)).toBe(SV_SCHEMA_VERSION);
  });

  it("skips migrations when already at latest version", () => {
    const executor = createExecutor(sqlite);
    // First init — runs migrations
    initServerSchema(executor, 0);

    // Simulate re-initialization with current version
    // Should not throw and should not double-persist
    expect(() => initServerSchema(executor, SV_SCHEMA_VERSION)).not.toThrow();
  });

  // ── Schema correctness ──────────────────────────────────────────────

  it("devices table has expected columns", () => {
    const executor = createExecutor(sqlite);
    initServerSchema(executor, 0);

    const columns = executor.all<{ name: string }>(
      "PRAGMA table_info('devices')",
    );
    const colNames = columns.map((c) => c.name);

    expect(colNames).toContain("id");
    expect(colNames).toContain("name");
    expect(colNames).toContain("token_hash");
    expect(colNames).toContain("is_admin");
    expect(colNames).toContain("created_at");
    expect(colNames).toContain("last_seen_at");
    // v1 migration adds last_sync_at
    expect(colNames).toContain("last_sync_at");
  });

  it("sync_tombstones table has expected columns", () => {
    const executor = createExecutor(sqlite);
    initServerSchema(executor, 0);

    const columns = executor.all<{ name: string }>(
      "PRAGMA table_info('sync_tombstones')",
    );
    const colNames = columns.map((c) => c.name);

    expect(colNames).toContain("id");
    expect(colNames).toContain("table_name");
    expect(colNames).toContain("row_id");
    expect(colNames).toContain("deleted_at");
  });

  it("sync_tombstone_acks has composite primary key", () => {
    const executor = createExecutor(sqlite);
    initServerSchema(executor, 0);

    const columns = executor.all<{ name: string; pk: number }>(
      "PRAGMA table_info('sync_tombstone_acks')",
    );
    const pkCols = columns.filter((c) => c.pk > 0);
    expect(pkCols.length).toBe(2); // (tombstone_id, device_id)
  });
});
