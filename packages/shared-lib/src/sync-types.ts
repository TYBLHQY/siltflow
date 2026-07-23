/**
 * Shared sync protocol types.
 *
 * Used by both the sync server (apps/sync-server) and sync clients
 * (desktop Electron, mobile Expo) so they agree on API contracts.
 */

// ── Entity tables ──────────────────────────────────────────────────────

export const ENTITY_TABLES = [
  "documents",
  "folders",
  "annotations",
  "ai_results",
  "fsrs_cards",
  "summaries",
  "review_logs",
] as const;

export type EntityTable = (typeof ENTITY_TABLES)[number];

// ── Push ───────────────────────────────────────────────────────────────

export interface SyncPushBody {
  lastSyncAt: string;
  changes: Partial<Record<EntityTable, {
    created?: Record<string, unknown>[];
    updated?: Record<string, unknown>[];
    deleted?: string[];
  }>>;
}

export interface SyncPushResponse {
  accepted: number;
  conflicts: ConflictItem[];
}

export interface ConflictItem {
  table: string;
  id: string;
  conflict: {
    serverUpdatedAt: string;
    clientUpdatedAt: string;
  };
}

// ── Pull ───────────────────────────────────────────────────────────────

export interface SyncPullBody {
  lastSyncAt: string;
}

export interface SyncPullResponse {
  serverTime: string;
  changes: Partial<Record<string, Record<string, unknown>[]>>;
  tombstones: TombstoneItem[];
}

export interface TombstoneItem {
  table_name: string;
  row_id: string;
  deleted_at: string;
}

// ── WebSocket notifications ────────────────────────────────────────────

export interface SyncAvailablePayload {
  type: "sync:available";
  changedBy: string;
  timestamp: string;
  accepted: number;
  conflictCount: number;
}

// ── Auth ────────────────────────────────────────────────────────────────

export interface AuthBootstrapBody {
  deviceName?: string;
}

export interface AuthBootstrapResponse {
  deviceId: string;
  deviceName: string;
  token: string;
  serverUrl: string;
  warning: string;
}

export interface AuthRegisterBody {
  deviceName: string;
}

export interface AuthRegisterResponse {
  deviceId: string;
  deviceName: string;
  token: string;
  serverUrl: string;
  warning: string;
}

export interface AuthVerifyResponse {
  deviceId: string;
  deviceName: string;
  isAdmin: boolean;
}

// ── Sync state (client-side) ────────────────────────────────────────────

export interface SyncState {
  lastPushAt: string | null;
  lastPullAt: string | null;
  syncInProgress: boolean;
  lastError: string | null;
  connected: boolean;
}

export interface SyncConfig {
  serverUrl: string;
  deviceToken: string;
  deviceId: string;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
}
