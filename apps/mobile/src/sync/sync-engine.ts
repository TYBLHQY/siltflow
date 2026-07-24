/**
 * Sync engine — orchestrates push/pull between the local SQLite database
 * and the remote sync server.
 *
 * Runs in the React Native JS thread. Uses:
 * - SyncClient for authenticated HTTP calls
 * - SyncWsClient for real-time "sync:available" notifications
 * - Changelog for tracking local deletions
 * - Timestamp queries for detecting local creates/updates
 * - expo-sqlite synchronous API for raw SQL
 *
 * Adapted from apps/desktop/electron/sync/sync-engine.ts
 */

import type { SQLiteBindValue } from "expo-sqlite";
import { getSQLite } from "@/stores/db.store";
import { ENTITY_TABLES } from "@siltflow/shared-lib";
import type {
  EntityTable,
  SyncPushBody,
  SyncPushResponse,
} from "@siltflow/shared-lib";
import type { SyncClient } from "./sync-client";
import type { SyncWsClient } from "./ws-client";
import {
  getDeletionsSince,
  clearDeletions,
} from "./changelog";

// ── Tables with composite primary keys ──────────────────────────────

export const COMPOSITE_PK_TABLES: Record<string, string[]> = {
  annotations: ["id", "document_id"],
  ai_results: ["annotation_id", "document_id"],
  fsrs_cards: ["annotation_id", "document_id"],
  review_logs: ["id", "annotation_id", "document_id"],
};

/** DDL for creating the sync_conflicts table (idempotent). */
const CONFLICTS_DDL = `
  CREATE TABLE IF NOT EXISTS sync_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    local_data TEXT,
    remote_data TEXT NOT NULL,
    server_updated_at TEXT NOT NULL,
    client_updated_at TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`;

/** Timestamp column used for change detection per table. */
function tsCol(table: string): string {
  return table === "review_logs" ? "created_at" : "updated_at";
}

// ── Types ───────────────────────────────────────────────────────────

export interface SyncState {
  lastPushAt: string | null;
  lastPullAt: string | null;
  syncInProgress: boolean;
  lastError: string | null;
  connected: boolean;
}

export interface ConflictRecord {
  id: number;
  table_name: string;
  row_id: string;
  local_data: string;
  remote_data: string;
  server_updated_at: string;
  client_updated_at: string;
  resolved: number;
  created_at: string;
}

export type StateChangeCallback = (state: SyncState) => void;
export type ErrorCallback = (err: Error) => void;
export type ConflictsCallback = (conflicts: { table: string; id: string; conflict: { serverUpdatedAt: string; clientUpdatedAt: string } }[]) => void;

// ── Engine ──────────────────────────────────────────────────────────

export class SyncEngine {
  private client: SyncClient;
  private ws: SyncWsClient;

  private _lastPushAt: string | null = null;
  private _lastPullAt: string | null = null;
  private _syncInProgress = false;
  private _pushInProgress = false;
  private _lastError: string | null = null;

  // Callback registrations
  private _onStateChange: StateChangeCallback[] = [];
  private _onError: ErrorCallback[] = [];
  private _onConflicts: ConflictsCallback[] = [];

  constructor(client: SyncClient, ws: SyncWsClient) {
    this.client = client;
    this.ws = ws;
    // Ensure sync_conflicts table exists
    const sql = getSQLite();
    sql.execSync(CONFLICTS_DDL);
  }

  // ── Callback registration ────────────────────────────────────────

  onStateChange(cb: StateChangeCallback): void {
    this._onStateChange.push(cb);
  }

  onError(cb: ErrorCallback): void {
    this._onError.push(cb);
  }

  onConflicts(cb: ConflictsCallback): void {
    this._onConflicts.push(cb);
  }

  // ── Public API ────────────────────────────────────────────────────

  get state(): SyncState {
    return {
      lastPushAt: this._lastPushAt,
      lastPullAt: this._lastPullAt,
      syncInProgress: this._syncInProgress,
      lastError: this._lastError,
      connected: this.ws.connected,
    };
  }

  set lastPushAt(v: string | null) { this._lastPushAt = v; }
  set lastPullAt(v: string | null) { this._lastPullAt = v; }

  /** Full two-way sync: push local changes, then pull remote. */
  async sync(): Promise<void> {
    if (this._syncInProgress) return;
    this._syncInProgress = true;
    this._lastError = null;
    this._emitState();

    console.log("[Sync:Engine] sync() start — lastPushAt:", this._lastPushAt, "lastPullAt:", this._lastPullAt);

    try {
      await this.pushIncremental();
    } catch (err) {
      this._lastError = (err as Error).message;
      this._emitState();
      for (const cb of this._onError) cb(err as Error);
    }

    try {
      await this.pull();
    } catch (err) {
      this._lastError = (err as Error).message;
      this._emitState();
      for (const cb of this._onError) cb(err as Error);
    } finally {
      console.log("[Sync:Engine] sync() end — lastPushAt:", this._lastPushAt, "lastPullAt:", this._lastPullAt);
      this._syncInProgress = false;
      this._emitState();
    }
  }

  /** One-shot: push all local data as "created" (initial sync). */
  async pushFull(): Promise<SyncPushResponse> {
    const sql = getSQLite();
    const changes: SyncPushBody["changes"] = {};

    for (const table of ENTITY_TABLES) {
      const rows = sql.getAllSync<Record<string, unknown>>(
        `SELECT * FROM ${table}`,
      );
      if (rows.length > 0) {
        const camelRows = rows.map((r) => this.camelKeys(r));
        changes[table] = { created: camelRows };
      }
      console.log("[Sync:Engine] pushFull — table:", table, "rows:", rows.length);
    }

    // Also send deletions from changelog
    const deletions = getDeletionsSince("1970-01-01T00:00:00Z");
    console.log("[Sync:Engine] pushFull — deletions from changelog:", deletions.length);
    for (const del of deletions) {
      if (!changes[del.table_name as EntityTable]) {
        changes[del.table_name as EntityTable] = {};
      }
      if (!changes[del.table_name as EntityTable]!.deleted) {
        changes[del.table_name as EntityTable]!.deleted = [];
      }
      changes[del.table_name as EntityTable]!.deleted!.push(del.row_id);
    }

    const body: SyncPushBody = {
      lastSyncAt: this._lastPushAt ?? "1970-01-01T00:00:00Z",
      changes,
    };

    const res = await this.client.push(body);
    this._lastPushAt = new Date().toISOString();

    // Clear changelog entries that were pushed
    if (deletions.length > 0) {
      clearDeletions(deletions.map((d) => d.id));
    }

    if (res.conflicts.length > 0) {
      this.storeConflicts(res);
      for (const cb of this._onConflicts) cb(res.conflicts);
    }

    this._emitState();
    return res;
  }

  /** Push only changes since last push. */
  async pushIncremental(): Promise<SyncPushResponse | null> {
    if (this._pushInProgress) return null;
    this._pushInProgress = true;

    try {
    const sql = getSQLite();
    const since = this._lastPushAt ?? "1970-01-01T00:00:00Z";
    const changes: SyncPushBody["changes"] = {};
    let hasChanges = false;

    console.log("[Sync:Engine] pushIncremental — since:", since);

    for (const table of ENTITY_TABLES) {
      const col = tsCol(table);

      // Created rows (created_at > lastPushAt)
      const created = sql.getAllSync<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE created_at > ?`,
        since,
      );
      if (created.length > 0) {
        if (!changes[table]) changes[table] = {};
        changes[table]!.created = created.map((r) => this.camelKeys(r));
        hasChanges = true;
      }

      // Updated rows (updated_at > lastPushAt AND created_at <= lastPushAt)
      if (table !== "review_logs") {
        const updated = sql.getAllSync<Record<string, unknown>>(
          `SELECT * FROM ${table} WHERE ${col} > ? AND created_at <= ?`,
          since,
          since,
        );
        if (updated.length > 0) {
          if (!changes[table]) changes[table] = {};
          changes[table]!.updated = updated.map((r) => this.camelKeys(r));
          hasChanges = true;
        }
      }

      if (created.length > 0 || (table !== "review_logs" && (
        changes[table]?.updated?.length ?? 0) > 0)) {
        console.log("[Sync:Engine] pushIncremental — table:", table,
          "created:", created.length,
          table !== "review_logs" ? `updated: ${changes[table]?.updated?.length ?? 0}` : "");
      }
    }

    // Deletions from changelog
    const deletions = getDeletionsSince(since);
    if (deletions.length > 0) {
      console.log("[Sync:Engine] pushIncremental — deletions:", deletions.length);
    }
    for (const del of deletions) {
      const tbl = del.table_name as EntityTable;
      if (!changes[tbl]) changes[tbl] = {};
      if (!changes[tbl]!.deleted) changes[tbl]!.deleted = [];
      changes[tbl]!.deleted!.push(del.row_id);
      hasChanges = true;
    }

    if (!hasChanges) {
      console.log("[Sync:Engine] pushIncremental — no local changes, skipping push");
      this._pushInProgress = false;
      return null;
    }

    const body: SyncPushBody = { lastSyncAt: since, changes };
    const res = await this.client.push(body);
    console.log("[Sync:Engine] pushIncremental — server accepted:", res.accepted, "conflicts:", res.conflicts.length);
    this._lastPushAt = new Date().toISOString();

    // Clear pushed changelog entries
    clearDeletions(deletions.map((d) => d.id));

    // Store conflicts
    if (res.conflicts.length > 0) {
      this.storeConflicts(res);
      for (const cb of this._onConflicts) cb(res.conflicts);
    }

    this._emitState();
    return res;
    } finally {
      this._pushInProgress = false;
    }
  }

  /** Pull remote changes and apply them locally. */
  async pull(): Promise<void> {
    // Guard against concurrent pulls: if a sync is already in progress
    // the pull step will run as part of that sync. Concurrent pulls
    // cause INSERT OR REPLACE races on the same rows.
    if (this._syncInProgress) {
      console.log("[Sync:Engine] pull — skipped (sync already in progress)");
      return;
    }
    const sql = getSQLite();
    const since = this._lastPullAt ?? "1970-01-01T00:00:00Z";
    const body = { lastSyncAt: since };
    console.log("[Sync:Engine] pull — since:", since);
    const res = await this.client.pull(body);

    let totalRows = 0;
    // Apply changes row-by-row
    for (const table of ENTITY_TABLES) {
      const rows = res.changes?.[table];
      if (!rows || rows.length === 0) continue;

      console.log("[Sync:Engine] pull — table:", table, "rows:", rows.length);

      // Log fsrs_cards and review_logs data for debugging
      if (table === "fsrs_cards" || table === "review_logs") {
        for (let i = 0; i < Math.min(rows.length, 3); i++) {
          const r = rows[i] as Record<string, unknown>;
          console.log(`[Sync:Engine] pull — ${table}[${i}]:`, JSON.stringify(r).slice(0, 200));
        }
      }

      for (const row of rows) {
        totalRows++;
        this.upsertRemoteRow(sql, table, row);
      }
    }

    // Apply tombstones (delete local rows that were deleted remotely)
    if (res.tombstones.length > 0) {
      console.log("[Sync:Engine] pull — tombstones:", res.tombstones.length);
      for (const t of res.tombstones.slice(0, 5)) {
        console.log(`[Sync:Engine] pull — tombstone: ${t.table_name} row=${t.row_id}`);
      }
    }
    for (const tombstone of res.tombstones) {
      this.applyTombstone(sql, tombstone.table_name, tombstone.row_id);
    }

    console.log("[Sync:Engine] pull — total rows upserted:", totalRows,
      "tombstones:", res.tombstones.length,
      "serverTime:", res.serverTime);
    this._lastPullAt = res.serverTime;
    this._emitState();
  }

  // ── Conflict storage ──────────────────────────────────────────────

  private storeConflicts(res: SyncPushResponse): void {
    const sql = getSQLite();
    const now = new Date().toISOString();

    for (const c of res.conflicts) {
      // Fetch local row for reference
      const localRow = sql.getFirstSync<Record<string, unknown>>(
        `SELECT * FROM ${c.table} WHERE id = ?`,
        c.id,
      );

      sql.runSync(
        `INSERT INTO sync_conflicts
          (table_name, row_id, local_data, remote_data, server_updated_at, client_updated_at, resolved, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        c.table,
        c.id,
        localRow ? JSON.stringify(localRow) : "{}",
        JSON.stringify(c.conflict),
        c.conflict.serverUpdatedAt,
        c.conflict.clientUpdatedAt,
        now,
      );
    }
  }

  getConflicts(): ConflictRecord[] {
    const sql = getSQLite();
    return sql.getAllSync<ConflictRecord>(
      "SELECT * FROM sync_conflicts WHERE resolved = 0 ORDER BY created_at DESC",
    );
  }

  resolveConflict(id: number, resolution: "local" | "remote"): void {
    const sql = getSQLite();
    const conflict = sql.getFirstSync<ConflictRecord>(
      "SELECT * FROM sync_conflicts WHERE id = ?",
      id,
    );
    if (!conflict) return;

    if (resolution === "remote") {
      // Parse remote data and upsert
      const remote = JSON.parse(conflict.remote_data) as Record<string, unknown>;
      this.upsertRemoteRow(sql, conflict.table_name, { id: conflict.row_id, ...remote });
    }
    // "local": do nothing (local version is already there)

    sql.runSync(
      "UPDATE sync_conflicts SET resolved = 1 WHERE id = ?",
      id,
    );
  }

  // ── Tombstone helpers ─────────────────────────────────────────────

  private applyTombstone(
    sql: ReturnType<typeof getSQLite>,
    tableName: string,
    rowId: string,
  ): void {
    const cols = COMPOSITE_PK_TABLES[tableName];
    if (cols) {
      const parts = rowId.split("|");
      const clauses = cols.map((c) => `${c} = ?`).join(" AND ");
      sql.runSync(
        `DELETE FROM ${tableName} WHERE ${clauses}`,
        ...parts.slice(0, cols.length),
      );
    } else {
      sql.runSync(`DELETE FROM ${tableName} WHERE id = ?`, rowId);
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────

  private upsertRemoteRow(
    sql: ReturnType<typeof getSQLite>,
    table: string,
    row: Record<string, unknown>,
  ): void {
    // Server returns snake_case keys (raw SQL column names) which match the
    // local DB columns directly — no conversion needed.
    const keys = Object.keys(row);
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((k) => row[k] as SQLiteBindValue);
    sql.runSync(
      `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
      ...values,
    );
  }

  /**
   * Convert snake_case column names to camelCase for the sync JSON protocol.
   */
  private camelKeys(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      out[camel] = value;
    }
    return out;
  }

  private _emitState(): void {
    for (const cb of this._onStateChange) cb(this.state);
  }
}
