/**
 * Sync engine — orchestrates push/pull between the local SQLite database
 * and the remote sync server.
 *
 * Runs in the Electron main process. Uses:
 * - SyncClient for authenticated HTTP calls
 * - SyncWsClient for real-time "sync:available" notifications
 * - OpLog for tracking local writes (saves + deletes)
 *
 * Design: single-user mirror model. Every write is recorded in sync_op_log.
 * Push reads the log and sends full row data. The server unconditionally
 * accepts everything with INSERT OR REPLACE. No timestamp-based change
 * detection, no client-side created/updated classification, no conflicts.
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
  getOpLogSince,
  clearOpLogEntries,
} from "./op-log";

// -- Tables with composite primary keys ----------------------------------

export const COMPOSITE_PK_TABLES: Record<string, string[]> = {
  annotations: ["id", "document_id"],
  ai_results: ["annotation_id", "document_id"],
  fsrs_cards: ["annotation_id", "document_id"],
  review_logs: ["id", "annotation_id", "document_id"],
};

/** DDL for creating the sync_op_log table (idempotent). */
const OP_LOG_DDL = `
  CREATE TABLE IF NOT EXISTS sync_op_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('save', 'delete')),
    row_data TEXT,
    created_at TEXT NOT NULL
  );
`;

// -- Events -------------------------------------------------------------

export interface SyncState {
  lastPushAt: string | null;
  lastPullAt: string | null;
  syncInProgress: boolean;
  lastError: string | null;
  connected: boolean;
}

export class SyncEngine extends EventEmitter {
  private client: SyncClient;
  private ws: SyncWsClient;
  private sql: Database.Database;

  private _lastPushAt: string | null = null;
  private _lastPullAt: string | null = null;
  private _syncInProgress = false;
  private _pushInProgress = false;
  private _pullInProgress = false;
  private _lastError: string | null = null;

  constructor(client: SyncClient, ws: SyncWsClient, sql: Database.Database) {
    super();
    this.client = client;
    this.ws = ws;
    this.sql = sql;
    // Ensure sync_op_log table exists
    sql.exec(OP_LOG_DDL);
  }

  // -- Public API -------------------------------------------------------

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

    console.log("[Sync:Desktop] sync() start — lastPushAt:", this._lastPushAt,
      "lastPullAt:", this._lastPullAt);

    try {
      await this.pushOpLog();
    } catch (err) {
      this._lastError = (err as Error).message;
      this._emitState();
      this.emit("error", err as Error);
    }

    try {
      await this.pull();
    } catch (err) {
      this._lastError = (err as Error).message;
      this._emitState();
      this.emit("error", err as Error);
    } finally {
      this._syncInProgress = false;
      console.log("[Sync:Desktop] sync() end — lastPushAt:", this._lastPushAt,
        "lastPullAt:", this._lastPullAt);
      this._emitState();
    }
  }

  /** Push local write operations that haven't been sent yet. */
  async pushOpLog(): Promise<SyncPushResponse | null> {
    if (this._pushInProgress) return null;
    this._pushInProgress = true;

    try {
    const since = this._lastPushAt ?? "1970-01-01T00:00:00Z";
    const entries = getOpLogSince(this.sql, since);

    if (entries.length === 0) {
      console.log("[Sync:Desktop] pushOpLog — no entries since", since);
      this._pushInProgress = false;
      return null;
    }

    console.log("[Sync:Desktop] pushOpLog — entries:", entries.length, "since:", since);

    // Group entries by table → {saves: [...rows], deletes: [...rowIds]}
    const changes: SyncPushBody["changes"] = {};
    for (const entry of entries) {
      const tbl = entry.table_name as EntityTable;
      if (!changes[tbl]) changes[tbl] = { saves: [], deletes: [] };

      if (entry.action === "save" && entry.row_data) {
        changes[tbl]!.saves!.push(JSON.parse(entry.row_data));
      } else if (entry.action === "delete") {
        changes[tbl]!.deletes!.push(entry.row_id);
      }
    }

    // Log what we're sending
    for (const [table, change] of Object.entries(changes)) {
      const saveCount = change.saves?.length ?? 0;
      const delCount = change.deletes?.length ?? 0;
      if (saveCount > 0 || delCount > 0) {
        console.log("[Sync:Desktop] pushOpLog — table:", table,
          "saves:", saveCount, "deletes:", delCount);
      }
    }

    const body: SyncPushBody = { lastSyncAt: since, changes };
    const res = await this.client.push(body);
    console.log("[Sync:Desktop] pushOpLog — server accepted:", res.accepted);

    this._lastPushAt = new Date().toISOString();

    // Clear the entries we just pushed
    clearOpLogEntries(this.sql, entries.map((e) => e.id));

    this._emitState();
    return res;
    } finally {
      this._pushInProgress = false;
    }
  }

  /** Pull remote changes and apply them locally. */
  async pull(): Promise<void> {
    if (this._pullInProgress) {
      console.log("[Sync:Desktop] pull — skipped (pull already in progress)");
      return;
    }
    this._pullInProgress = true;
    try {
      const body = {
        lastSyncAt: this._lastPullAt ?? "1970-01-01T00:00:00Z",
      };
      console.log("[Sync:Desktop] pull — since:", body.lastSyncAt);
      const res = await this.client.pull(body);

      let totalRows = 0;
      for (const table of ENTITY_TABLES) {
        const rows = res.changes?.[table];
        if (!rows || rows.length === 0) continue;

        console.log("[Sync:Desktop] pull — table:", table, "rows:", rows.length);

        if (table === "fsrs_cards" || table === "review_logs") {
          for (let i = 0; i < Math.min(rows.length, 3); i++) {
            const r = rows[i] as Record<string, unknown>;
            console.log(`[Sync:Desktop] pull — ${table}[${i}]:`, JSON.stringify(r).slice(0, 200));
          }
        }

        for (const row of rows) {
          totalRows++;
          this.upsertRemoteRow(table, row);
        }
      }

      if (res.tombstones.length > 0) {
        console.log("[Sync:Desktop] pull — tombstones:", res.tombstones.length);
        for (const t of res.tombstones.slice(0, 5)) {
          console.log(`[Sync:Desktop] pull — tombstone: ${t.table_name} row=${t.row_id}`);
        }
      }
      for (const tombstone of res.tombstones) {
        this.applyTombstone(tombstone.table_name, tombstone.row_id);
      }

      console.log("[Sync:Desktop] pull — total rows upserted:", totalRows,
        "tombstones:", res.tombstones.length,
        "serverTime:", res.serverTime);
      this._lastPullAt = res.serverTime;
      this._emitState();
    } finally {
      this._pullInProgress = false;
    }
  }

  // -- Tombstone helpers ------------------------------------------------

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

  // -- Internal helpers -------------------------------------------------

  private upsertRemoteRow(table: string, row: Record<string, unknown>): void {
    // Server returns snake_case keys (raw SQL column names). Use them directly.
    const keys = Object.keys(row);
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((k) => row[k]);
    this.sql
      .prepare(
        `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`
      )
      .run(...values);
  }

  /**
   * Convert snake_case column names to camelCase for the sync JSON protocol.
   * Used when reading rows from the local DB for the op_log (save entries).
   */
  camelKeys(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      out[camel] = value;
    }
    return out;
  }

  private _emitState(): void {
    this.emit("state-change", this.state);
  }
}
