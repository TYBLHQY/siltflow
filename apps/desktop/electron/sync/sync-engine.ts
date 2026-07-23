/**
 * Sync engine — orchestrates push/pull between the local SQLite database
 * and the remote sync server.
 *
 * Runs in the Electron main process. Uses:
 * - SyncClient for authenticated HTTP calls
 * - SyncWsClient for real-time "sync:available" notifications
 * - Changelog for tracking local deletions
 * - Timestamp queries for detecting local creates/updates
 */

import { EventEmitter } from "node:events";
import type Database from "better-sqlite3";
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

const COMPOSITE_PK_TABLES: Record<string, string[]> = {
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

// ── Events ──────────────────────────────────────────────────────────

export interface SyncState {
  lastPushAt: string | null;
  lastPullAt: string | null;
  syncInProgress: boolean;
  lastError: string | null;
  connected: boolean;
}

export interface ConflictRecord {
  id: number;
  tableName: string;
  rowId: string;
  localData: string;
  remoteData: string;
  serverUpdatedAt: string;
  clientUpdatedAt: string;
  resolved: number;
  createdAt: string;
}

export class SyncEngine extends EventEmitter {
  private client: SyncClient;
  private ws: SyncWsClient;
  private sql: Database.Database;

  private _lastPushAt: string | null = null;
  private _lastPullAt: string | null = null;
  private _syncInProgress = false;
  private _lastError: string | null = null;

  constructor(client: SyncClient, ws: SyncWsClient, sql: Database.Database) {
    super();
    this.client = client;
    this.ws = ws;
    this.sql = sql;
    // Ensure sync_conflicts table exists
    sql.exec(CONFLICTS_DDL);
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

  /** Full two-way sync: push local changes, then pull remote. */
  async sync(): Promise<void> {
    if (this._syncInProgress) return;
    this._syncInProgress = true;
    this._lastError = null;
    this._emitState();

    try {
      await this.pushIncremental();
      await this.pull();
    } catch (err) {
      this._lastError = (err as Error).message;
      this._emitState();
      this.emit("error", err as Error);
    } finally {
      this._syncInProgress = false;
      this._emitState();
    }
  }

  /** One-shot: push all local data as "created" (initial sync). */
  async pushFull(): Promise<SyncPushResponse> {
    const changes: SyncPushBody["changes"] = {};

    for (const table of ENTITY_TABLES) {
      const rows = this.sql
        .prepare(`SELECT * FROM ${table}`)
        .all() as Record<string, unknown>[];
      if (rows.length > 0) {
        const camelRows = rows.map((r) => this.camelKeys(r, table));
        changes[table] = { created: camelRows };
      }
    }

    // Also send deletions from changelog
    const deletions = getDeletionsSince(this.sql, "1970-01-01T00:00:00Z");
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
      clearDeletions(this.sql, deletions.map((d) => d.id));
    }

    if (res.conflicts.length > 0) {
      this.storeConflicts(res);
      this.emit("conflicts", res.conflicts);
    }

    this._emitState();
    return res;
  }

  /** Push only changes since last push. */
  async pushIncremental(): Promise<SyncPushResponse | null> {
    const since = this._lastPushAt ?? "1970-01-01T00:00:00Z";
    const changes: SyncPushBody["changes"] = {};
    let hasChanges = false;

    for (const table of ENTITY_TABLES) {
      const col = tsCol(table);

      // Created rows (created_at > lastPushAt)
      const created = this.sql
        .prepare(`SELECT * FROM ${table} WHERE created_at > ?`)
        .all(since) as Record<string, unknown>[];
      if (created.length > 0) {
        if (!changes[table]) changes[table] = {};
        changes[table]!.created = created.map((r) => this.camelKeys(r, table));
        hasChanges = true;
      }

      // Updated rows (updated_at > lastPushAt AND created_at <= lastPushAt)
      if (table !== "review_logs") {
        const updated = this.sql
          .prepare(
            `SELECT * FROM ${table} WHERE ${col} > ? AND created_at <= ?`,
          )
          .all(since, since) as Record<string, unknown>[];
        if (updated.length > 0) {
          if (!changes[table]) changes[table] = {};
          changes[table]!.updated = updated.map((r) => this.camelKeys(r, table));
          hasChanges = true;
        }
      }
    }

    // Deletions from changelog
    const deletions = getDeletionsSince(this.sql, since);
    for (const del of deletions) {
      const tbl = del.table_name as EntityTable;
      if (!changes[tbl]) changes[tbl] = {};
      if (!changes[tbl]!.deleted) changes[tbl]!.deleted = [];
      changes[tbl]!.deleted!.push(del.row_id);
      hasChanges = true;
    }

    if (!hasChanges) return null;

    const body: SyncPushBody = { lastSyncAt: since, changes };
    const res = await this.client.push(body);
    this._lastPushAt = new Date().toISOString();

    // Clear pushed changelog entries
    clearDeletions(this.sql, deletions.map((d) => d.id));

    // Store conflicts
    if (res.conflicts.length > 0) {
      this.storeConflicts(res);
      this.emit("conflicts", res.conflicts);
    }

    this._emitState();
    return res;
  }

  /** Pull remote changes and apply them locally. */
  async pull(): Promise<void> {
    const body = {
      lastSyncAt: this._lastPullAt ?? "1970-01-01T00:00:00Z",
    };
    const res = await this.client.pull(body);

    // Apply changes row-by-row
    for (const table of ENTITY_TABLES) {
      const rows = res.changes?.[table];
      if (!rows || rows.length === 0) continue;

      for (const row of rows) {
        this.upsertRemoteRow(table, row);
      }
    }

    // Apply tombstones (delete local rows that were deleted remotely)
    for (const tombstone of res.tombstones) {
      this.applyTombstone(tombstone.table_name, tombstone.row_id);
    }

    this._lastPullAt = res.serverTime;
    this._emitState();
  }

  // ── Conflict storage ──────────────────────────────────────────────

  private storeConflicts(res: SyncPushResponse): void {
    const insertSql = `
      INSERT INTO sync_conflicts
        (table_name, row_id, local_data, remote_data, server_updated_at, client_updated_at, resolved, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `;
    const stmt = this.sql.prepare(insertSql);
    const now = new Date().toISOString();

    for (const c of res.conflicts) {
      // Fetch local row for reference
      const localRow = this.sql
        .prepare(`SELECT * FROM ${c.table} WHERE id = ?`)
        .get(c.id) as Record<string, unknown> | undefined;

      stmt.run(
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
    return this.sql
      .prepare(
        "SELECT * FROM sync_conflicts WHERE resolved = 0 ORDER BY created_at DESC",
      )
      .all() as ConflictRecord[];
  }

  resolveConflict(id: number, resolution: "local" | "remote"): void {
    const conflict = this.sql
      .prepare("SELECT * FROM sync_conflicts WHERE id = ?")
      .get(id) as ConflictRecord | undefined;
    if (!conflict) return;

    if (resolution === "remote") {
      // Fetch remote data and upsert
      const remote = JSON.parse(conflict.remoteData);
      this.upsertRemoteRow(conflict.tableName, { id: conflict.rowId, ...remote });
    }
    // "local": do nothing (local version is already there)

    this.sql
      .prepare("UPDATE sync_conflicts SET resolved = 1 WHERE id = ?")
      .run(id);
  }

  // ── Tombstone helpers ─────────────────────────────────────────────

  private applyTombstone(tableName: string, rowId: string): void {
    const cols = COMPOSITE_PK_TABLES[tableName];
    if (cols) {
      const parts = rowId.split("|");
      const clauses = cols.map((c) => `${c} = ?`).join(" AND ");
      this.sql
        .prepare(`DELETE FROM ${tableName} WHERE ${clauses}`)
        .run(...parts.slice(0, cols.length));
    } else {
      this.sql.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(rowId);
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────

  private upsertRemoteRow(table: string, row: Record<string, unknown>): void {
    // Server returns snake_case keys (raw SQL column names) which match the
    // local DB columns directly — no conversion needed.
    const keys = Object.keys(row);
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((k) => row[k]);
    this.sql
      .prepare(
        `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
      )
      .run(...values);
  }

  /**
   * Convert snake_case column names to camelCase for the sync JSON protocol.
   * The local DB stores columns as-is from the Drizzle schema (snake_case in
   * SQL, e.g. "total_pages"). camelKeys is only used on push — the server
   * expects camelCase JSON keys. Pull uses the server response as-is because
   * the server also returns raw snake_case column names.
   */
  private camelKeys(row: Record<string, unknown>, _table: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      // snake_case (local DB column) → camelCase (JSON protocol)
      const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      out[camel] = value;
    }
    return out;
  }

  private _emitState(): void {
    this.emit("state-change", this.state);
  }
}
