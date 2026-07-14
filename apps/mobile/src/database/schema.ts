/**
 * SQL schema definitions for expo-sqlite.
 * Mirrors the desktop's Drizzle ORM schema for data compatibility.
 *
 * Tables:
 * - documents     — imported PDF files
 * - folders       — nested folder tree
 * - annotations   — highlighted text spans
 * - ai_results    — AI analysis (translation) results
 * - fsrs_cards    — per-annotation FSRS card state
 * - summaries     — per-document AI/manual summaries
 * - review_logs   — historical review grades and card snapshots
 */

// ---------------------------------------------------------------------------
// Raw row types (maps directly to SQLite rows)
// ---------------------------------------------------------------------------

export interface DocumentRow {
  id: string;
  title: string;
  original_name: string | null;
  total_pages: number | null;
  metadata: string | null;
  folder_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AnnotationRow {
  id: string;
  document_id: string;
  type: string;
  text: string | null;
  page_number: number | null;
  embed_data: string;
  created_at: string;
  updated_at: string;
}

export interface AiResultRow {
  annotation_id: string;
  document_id: string;
  data: string;
  created_at: string;
  updated_at: string;
}

export interface FsrsCardRow {
  annotation_id: string;
  document_id: string;
  data: string;
  created_at: string;
  updated_at: string;
}

export interface SummaryRow {
  document_id: string;
  text: string;
  is_ai_generated: number; // boolean
  source_lang: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewLogRow {
  id: string;
  annotation_id: string;
  document_id: string;
  data: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// SQL creation statements
// ---------------------------------------------------------------------------

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    original_name TEXT,
    total_pages INTEGER,
    metadata TEXT,
    folder_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS annotations (
    id TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    text TEXT,
    page_number INTEGER,
    embed_data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (id, document_id)
  );

  CREATE TABLE IF NOT EXISTS ai_results (
    annotation_id TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (annotation_id, document_id)
  );

  CREATE TABLE IF NOT EXISTS fsrs_cards (
    annotation_id TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (annotation_id, document_id)
  );

  CREATE TABLE IF NOT EXISTS summaries (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_ai_generated INTEGER NOT NULL DEFAULT 0,
    source_lang TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (document_id)
  );

  CREATE TABLE IF NOT EXISTS review_logs (
    id TEXT NOT NULL,
    annotation_id TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (id, annotation_id, document_id)
  );
`;

export const DROP_TABLES_SQL = `
  DROP TABLE IF EXISTS review_logs;
  DROP TABLE IF EXISTS fsrs_cards;
  DROP TABLE IF EXISTS ai_results;
  DROP TABLE IF EXISTS annotations;
  DROP TABLE IF EXISTS summaries;
  DROP TABLE IF EXISTS documents;
  DROP TABLE IF EXISTS folders;
`;
