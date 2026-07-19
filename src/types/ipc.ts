/**
 * IPC request / response types shared between the Electron preload and
 * the renderer's window.siltflow.* API.  Used to narrow vite-env.d.ts so
 * store / component code gets precise types instead of `any`.
 */

// ── Documents ──────────────────────────────────────────────────────────

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

// ── Annotations ────────────────────────────────────────────────────────

export interface AnnotationSaveRequest {
  id: string;
  documentId: string;
  type: string;
  text: string;
  pageNumber: number;
  embedData: string;
  kind?: string;
}

/** Raw annotation row returned by annotations:listAll */
export interface AnnotationRowIPC {
  id: string;
  document_id: string;
  type: string;
  text: string | null;
  page_number: number | null;
  embed_data: string;
  kind: string;
  created_at: string;
  updated_at: string;
}

/** Enriched row from annotations:list (JOINs ai_results + fsrs_cards) */
export interface AnnotationEnrichedIPC {
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
}

// ── Summaries ──────────────────────────────────────────────────────────

export interface SummaryRowIPC {
  document_id: string;
  text: string;
  is_ai_generated: number; // SQLite boolean as int
  source_lang: string | null;
  key_vocabulary?: string | null; // JSON string
  gist?: string | null;
  created_at: string;
  updated_at: string;
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

// ── AI Results ─────────────────────────────────────────────────────────

export interface AIResultSaveResult {
  annotationId: string;
  version: number;
}

// ── FSRS Cards ─────────────────────────────────────────────────────────

export interface FSRSCardSaveResult {
  annotationId: string;
}

// ── Review Logs ────────────────────────────────────────────────────────

export interface ReviewLogEntryIPC {
  id: string;
  annotation_id: string;
  document_id: string;
  data: string;
  created_at: string;
}

export interface ReviewLogSaveResult {
  id: string;
  created_at: string;
}

// ── Folders ────────────────────────────────────────────────────────────

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

// ── Update ─────────────────────────────────────────────────────────────

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}
