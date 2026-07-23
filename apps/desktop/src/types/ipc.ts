/**
 * IPC request / response types shared between the Electron preload and
 * the renderer's window.siltflow.* API.
 *
 * Base DB row types are imported from @siltflow/shared-db;
 * desktop-specific IPC shapes are defined here.
 */

// Re-export shared types that consumers previously imported from this file
export type {
  DocumentIPCItem,
  DocumentSaveRequest,
  AnnotationSaveRequest,
  SummarySaveRequest,
  SummarySaveResult,
  AIResultSaveResult,
  FSRSCardSaveResult,
  ReviewLogEntryIPC,
  ReviewLogSaveResult,
  FolderRowIPC,
  FolderCreateParams,
  UpdateProgress,
} from "@siltflow/shared-db/types";

// ── Annotation enriched type (still IPC-specific: JSON parsing happens in main process) ──

export type AnnotationEnrichedIPC = {
  id: string;
  document_id: string;
  type: string;
  text: string | null;
  page_number: number | null;
  embed_data: string;
  kind: string;
  created_at: string;
  updated_at: string;
  ai_data: string | null;
  ai_version: number | null;
  fsrs_data: string | null;
};

// ── Summary IPC row (snake_case column mapping used by IPC) ──────────

export type SummaryRowIPC = {
  documentId: string;
  text: string;
  isAiGenerated: number; // SQLite boolean stored as INTEGER
  sourceLang: string | null;
  createdAt: string;
  updatedAt: string;
};
