/**
 * Mobile service-layer types.
 *
 * Thin wrappers around shared-db domain types, keeping the service layer
 * decoupled from the Drizzle schema import path.
 */

export type {
  DocumentIPCItem,
  AnnotationEnriched,
  AnnotationSaveRequest,
  DocumentSaveRequest,
  SummarySaveRequest,
  SummarySaveResult,
  AIResultSaveResult,
  FSRSCardSaveResult,
  ReviewLogEntryIPC,
  ReviewLogSaveResult,
  FolderRowIPC,
  FolderCreateParams,
} from "@siltflow/shared-db/types";
