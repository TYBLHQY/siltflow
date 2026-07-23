/**
 * Server database schema.
 *
 * Uses the shared 7-table Drizzle schema from @siltflow/shared-db,
 * plus 3 server-only tables (devices, sync_tombstones, server_settings).
 *
 * The schema is assembled with object spread so Drizzle can infer
 * the full shape at the call site — matching the desktop pattern.
 */

import * as sharedSchema from "@siltflow/shared-db/schema";
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// ── Re-export shared tables ───────────────────────────────────────────

export const documents = sharedSchema.documents;
export const folders = sharedSchema.folders;
export const annotations = sharedSchema.annotations;
export const aiResults = sharedSchema.aiResults;
export const fsrsCards = sharedSchema.fsrsCards;
export const summaries = sharedSchema.summaries;
export const reviewLogs = sharedSchema.reviewLogs;

// ── Server-only tables ────────────────────────────────────────────────

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at"),
});

export const syncTombstones = sqliteTable("sync_tombstones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tableName: text("table_name").notNull(),
  rowId: text("row_id").notNull(),
  deletedAt: text("deleted_at").notNull(),
});

export const syncTombstoneAcks = sqliteTable(
  "sync_tombstone_acks",
  {
    tombstoneId: integer("tombstone_id")
      .notNull()
      .references(() => syncTombstones.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    ackedAt: text("acked_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tombstoneId, table.deviceId] }),
  }),
);

export const serverSettings = sqliteTable("server_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Combined schema object (for Drizzle init) ─────────────────────────

export const schema = {
  documents,
  folders,
  annotations,
  aiResults,
  fsrsCards,
  summaries,
  reviewLogs,
  devices,
  syncTombstones,
  syncTombstoneAcks,
  serverSettings,
};
