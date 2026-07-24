/**
 * Sync engine — orchestrates push/pull between the local SQLite database
 * and the remote sync server.
 *
 * Runs in the React Native JS thread. Uses:
 * - SyncClient for authenticated HTTP calls
 * - SyncWsClient for real-time "sync:available" notifications
 * - OpLog for tracking local writes (saves + deletes)
 *
 * Design: single-user mirror model. Every write is recorded in sync_op_log.
 * Push reads the log and sends full row data. The server unconditionally
 * accepts everything with INSERT OR REPLACE.
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
  getOpLogSince,
  clearOpLogEntries,
  seedOpLogFromExisting,
} from "./op-log";

// -- Tables with composite primary keys ----------------------------------

export const COMPOSITE_PK_TABLES: Record<string, string[]> = {
  annotations: ["id", "document_id"],
  ai_results: ["annotation_id", "document_id"],
  fsrs_cards: ["annotation_id", "document_id"],
  review_logs: ["id", "annotation_id", "document_id"],
};

// -- Types ---------------------------------------------------------------

export interface SyncState {
  lastPushAt: string | null;
  lastPullAt: string | null;
  syncInProgress: boolean;
  lastError: string | null;
  connected: boolean;
}

export type StateChangeCallback = (state: SyncState) => void;
export type ErrorCallback = (err: Error) => void;

// -- Engine --------------------------------------------------------------

export class SyncEngine {
  private client: SyncClient;
  private ws: SyncWsClient;

  private _lastPushAt: string | null = null;
  private _lastPullAt: string | null = null;
  private _syncInProgress = false;
  private _pushInProgress = false;
  private _pullInProgress = false;
  private _lastError: string | null = null;

  private _onStateChange: StateChangeCallback[] = [];
  private _onError: ErrorCallback[] = [];

  constructor(client: SyncClient, ws: SyncWsClient) {
    this.client = client;
    this.ws = ws;
    // Ensure sync_op_log table exists
    const sql = getSQLite();
    sql.execSync(`
      CREATE TABLE IF NOT EXISTS sync_op_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        row_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('save', 'delete')),
        row_data TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  // -- Callback registration --------------------------------------------

  onStateChange(cb: StateChangeCallback): void {
    this._onStateChange.push(cb);
  }

  onError(cb: ErrorCallback): void {
    this._onError.push(cb);
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

    console.log("[Sync:Engine] sync() start — lastPushAt:", this._lastPushAt,
      "lastPullAt:", this._lastPullAt);

    try {
      await this.pushOpLog();
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
      console.log("[Sync:Engine] sync() end — lastPushAt:", this._lastPushAt,
        "lastPullAt:", this._lastPullAt);
      this._syncInProgress = false;
      this._emitState();
    }
  }

  /** Push local write operations that haven't been sent yet. */
  async pushOpLog(): Promise<SyncPushResponse | null> {
    if (this._pushInProgress) return null;
    this._pushInProgress = true;

    try {
    const since = this._lastPushAt ?? "1970-01-01T00:00:00Z";
    let entries = getOpLogSince(since);

    // If first sync (lastPushAt is null) and op_log is empty, seed it
    // from existing data so the initial full sync works.
    if (since === "1970-01-01T00:00:00Z" && entries.length === 0) {
      console.log("[Sync:Engine] pushOpLog — op_log empty, seeding from existing data");
      seedOpLogFromExisting();
      entries = getOpLogSince(since);
    }

    if (entries.length === 0) {
      console.log("[Sync:Engine] pushOpLog — no entries since", since);
      this._pushInProgress = false;
      return null;
    }

    console.log("[Sync:Engine] pushOpLog — entries:", entries.length, "since:", since);

    // Group entries by table → {saves: [...], deletes: [...]}
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

    for (const [table, change] of Object.entries(changes)) {
      const saveCount = change.saves?.length ?? 0;
      const delCount = change.deletes?.length ?? 0;
      if (saveCount > 0 || delCount > 0) {
        console.log("[Sync:Engine] pushOpLog — table:", table,
          "saves:", saveCount, "deletes:", delCount);
      }
    }

    const body: SyncPushBody = { lastSyncAt: since, changes };
    const res = await this.client.push(body);
    console.log("[Sync:Engine] pushOpLog — server accepted:", res.accepted);

    this._lastPushAt = new Date().toISOString();

    // Clear the entries we just pushed
    clearOpLogEntries(entries.map((e) => e.id));

    this._emitState();
    return res;
    } finally {
      this._pushInProgress = false;
    }
  }

  // -- OpLog seeding ---------------------------------------------------

  /**
   * Seed the op_log with save entries for all existing rows across all
   * entity tables. Called once when the database already has data but
   * op_log is empty (first start after op_log migration, or epoch sync).
   *
   * Each existing row gets a 'save' entry so the next pushOpLog will
   * push all data to the server — equivalent to the old pushFull().
   */
  seedOpLogFromExisting(): void {
    seedOpLogFromExisting();
  }

  /** Pull remote changes and apply them locally. */
  async pull(): Promise<void> {
    if (this._pullInProgress) {
      console.log("[Sync:Engine] pull — skipped (pull already in progress)");
      return;
    }
    this._pullInProgress = true;
    try {
    const sql = getSQLite();
    const since = this._lastPullAt ?? "1970-01-01T00:00:00Z";
    const body = { lastSyncAt: since };
    console.log("[Sync:Engine] pull — since:", since);
    const res = await this.client.pull(body);

    let totalRows = 0;
    for (const table of ENTITY_TABLES) {
      const rows = res.changes?.[table];
      if (!rows || rows.length === 0) continue;

      console.log("[Sync:Engine] pull — table:", table, "rows:", rows.length);

      for (const row of rows) {
        totalRows++;
        this.upsertRemoteRow(sql, table, row);
      }
    }

    if (res.tombstones.length > 0) {
      console.log("[Sync:Engine] pull — tombstones:", res.tombstones.length);
    }
    for (const tombstone of res.tombstones) {
      this.applyTombstone(sql, tombstone.table_name, tombstone.row_id);
    }

    console.log("[Sync:Engine] pull — total rows upserted:", totalRows,
      "tombstones:", res.tombstones.length,
      "serverTime:", res.serverTime);
    this._lastPullAt = res.serverTime;
    this._emitState();
    } finally {
      this._pullInProgress = false;
    }
  }

  // -- Tombstone helpers ------------------------------------------------

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

  // -- Internal helpers -------------------------------------------------

  private upsertRemoteRow(
    sql: ReturnType<typeof getSQLite>,
    table: string,
    row: Record<string, unknown>,
  ): void {
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
  camelKeys(row: Record<string, unknown>): Record<string, unknown> {
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
