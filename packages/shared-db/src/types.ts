/**
 * Shared TypeScript types derived from the Drizzle schema.
 *
 * Two layers:
 * 1. Raw DB row types via Drizzle's `$inferSelect` / `$inferInsert`
 * 2. Enriched domain types (JSON columns parsed, JOIN results)
 */

import type {
  documents,
  folders,
  summaries,
  annotations,
  aiResults,
  fsrsCards,
  reviewLogs,
} from "./schema";

// ── Schema version ───────────────────────────────────────────────────

/** Current database schema version (stored as PRAGMA user_version). */
export const SCHEMA_VERSION = 4;

/** Current AI data format version written to ai_results.version on save. */
export const AI_DATA_VERSION = 1;

// ── Raw DB row types (auto-generated from schema) ────────────────────

export type Document = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type FolderInsert = typeof folders.$inferInsert;
export type Summary = typeof summaries.$inferSelect;
export type SummaryInsert = typeof summaries.$inferInsert;
export type Annotation = typeof annotations.$inferSelect;
export type AnnotationInsert = typeof annotations.$inferInsert;
export type AiResult = typeof aiResults.$inferSelect;
export type AiResultInsert = typeof aiResults.$inferInsert;
export type FsrsCard = typeof fsrsCards.$inferSelect;
export type FsrsCardInsert = typeof fsrsCards.$inferInsert;
export type ReviewLog = typeof reviewLogs.$inferSelect;
export type ReviewLogInsert = typeof reviewLogs.$inferInsert;

// ── Domain types (JSON columns parsed, JOIN enriched) ────────────────

/** Enriched annotation row from annotations:list (JOINs ai_results + fsrs_cards). */
export interface AnnotationEnriched {
  id: string;
  document_id: string;
  type: string;
  text: string | null;
  page_number: number | null;
  embed_data: unknown;
  kind: string;
  created_at: string;
  updated_at: string;
  ai_data: unknown;
  ai_version: number | null;
  fsrs_data: unknown;
}

// ── IPC / API types (shared between desktop preload and future mobile services) ──

export interface DocumentIPCItem {
  id: string;
  title: string;
  totalPages?: number | null;
  originalName?: string | null;
  folderId?: string | null;
  sortOrder?: number;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSaveRequest {
  id: string;
  title: string;
}

export interface AnnotationSaveRequest {
  id: string;
  document_id: string;
  type: string;
  text: string;
  page_number: number;
  embed_data: string;
  kind?: string;
}

export interface SummarySaveRequest {
  documentId: string;
  text: string;
  isAiGenerated: boolean;
  sourceLang?: string;
}

export interface SummarySaveResult {
  documentId: string;
}

export interface AIResultSaveResult {
  annotationId: string;
  version: number;
}

export interface FSRSCardSaveResult {
  annotationId: string;
}

export interface ReviewLogEntryIPC {
  id: string;
  annotationId: string;
  documentId: string;
  data: string;
  createdAt: string;
}

export interface ReviewLogSaveResult {
  id: string;
  createdAt: string;
}

export interface FolderRowIPC {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FolderCreateParams {
  name: string;
  parentId?: string | null;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}
