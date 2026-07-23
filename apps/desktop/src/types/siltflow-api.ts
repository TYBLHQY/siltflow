import type {
  DocumentIPCItem,
  DocumentSaveRequest,
  AnnotationSaveRequest,
  AnnotationEnrichedIPC,
  SummaryRowIPC,
  SummarySaveRequest,
  SummarySaveResult,
  AIResultSaveResult,
  FSRSCardSaveResult,
  ReviewLogEntryIPC,
  ReviewLogSaveResult,
  FolderRowIPC,
  FolderCreateParams,
  UpdateProgress,
} from "@/types/ipc";
import type { ReviewLogSaveRequest } from "@/types/review";
import type { DocReviewMetrics } from "@/lib/doc-review";
import type { Card } from "ts-fsrs";
import type {
  SyncState,
  SyncConfig,
  AuthBootstrapResponse,
  AuthRegisterResponse,
  AuthVerifyResponse,
} from "@siltflow/shared-lib";
import type { ConflictRecord } from "../../electron/sync/sync-engine";

export interface SiltflowAPI {
  vaultGetPath: () => Promise<string>;
  vaultSelect: () => Promise<string>;
  vaultConfigGet: () => Promise<Record<string, unknown>>;
  vaultConfigSet: (config: Record<string, unknown>) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  selectPdf: () => Promise<{ id: string; title: string }[] | null>;
  importPdfFolder: () => Promise<{
    docs: { id: string; title: string; folderId: string | null }[];
  } | null>;
  loadFile: (filePath: string) => Promise<ArrayBuffer>;
  dbSchemaVersion: () => Promise<number | null>;

  update: {
    check: () => Promise<void>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    onAvailable: (
      fn: (info: {
        version: string;
        releaseDate: string;
        releaseName?: string | null;
        releaseNotes?:
          string | Array<{ version: string; note: string | null }> | null;
      }) => void,
    ) => () => void;
    onNotAvailable: (fn: () => void) => () => void;
    onDownloadProgress: (fn: (progress: UpdateProgress) => void) => () => void;
    onDownloaded: (fn: () => void) => () => void;
    onError: (fn: (message: string) => void) => () => void;
  };
  documents: {
    list: () => Promise<DocumentIPCItem[]>;
    get: (id: string) => Promise<DocumentIPCItem | null>;
    save: (doc: DocumentSaveRequest) => Promise<DocumentIPCItem>;
    updateMetadata: (params: {
      id: string;
      totalPages: number;
      metadata: string;
    }) => Promise<void>;
    delete: (id: string) => Promise<void>;
    rename: (params: { id: string; title: string }) => Promise<void>;
  };
  annotations: {
    list: (documentId: string) => Promise<AnnotationEnrichedIPC[]>;
    listAll: () => Promise<AnnotationEnrichedIPC[]>;
    save: (annotation: AnnotationSaveRequest) => Promise<{ id: string }>;
    delete: (id: string, documentId: string) => Promise<void>;
  };
  summaries: {
    listAll: () => Promise<SummaryRowIPC[]>;
    get: (documentId: string) => Promise<SummaryRowIPC | null>;
    save: (summary: SummarySaveRequest) => Promise<SummarySaveResult>;
    delete: (documentId: string) => Promise<void>;
  };
  aiResults: {
    get: (annotationId: string, documentId: string) => Promise<string | null>;
    listByDocument: (
      documentId: string,
    ) => Promise<{ annotationId: string; data: string }[]>;
    save: (
      annotationId: string,
      documentId: string,
      data: unknown,
      version?: number,
    ) => Promise<AIResultSaveResult>;
    delete: (annotationId: string, documentId: string) => Promise<void>;
  };
  fsrsCards: {
    get: (annotationId: string, documentId: string) => Promise<string | null>;
    save: (
      annotationId: string,
      documentId: string,
      data: Card,
    ) => Promise<FSRSCardSaveResult>;
    delete: (annotationId: string, documentId: string) => Promise<void>;
    listByDocument: (
      documentId: string,
    ) => Promise<{ annotationId: string; data: string }[]>;
    listAll: () => Promise<
      {
        annotationId: string;
        documentId: string;
        data: string;
        createdAt: string;
        updatedAt: string;
      }[]
    >;
  };
  reviewLogs: {
    listByAnnotation: (
      annotationId: string,
      documentId: string,
    ) => Promise<ReviewLogEntryIPC[]>;
    listAll: () => Promise<
      {
        id: string;
        annotationId: string;
        documentId: string;
        data: string;
        createdAt: string;
      }[]
    >;
    save: (
      annotationId: string,
      documentId: string,
      data: ReviewLogSaveRequest,
    ) => Promise<ReviewLogSaveResult>;
  };
  tts: {
    speak: (
      text: string,
      options?: {
        voice?: string;
        rate?: string;
        volume?: string;
        pitch?: string;
        binaryPath?: string;
      },
    ) => Promise<number[]>;
    listVoices: (binaryPath?: string) => Promise<string[]>;
  };
  folders: {
    list: () => Promise<FolderRowIPC[]>;
    create: (params: FolderCreateParams) => Promise<FolderRowIPC>;
    rename: (params: { id: string; name: string }) => Promise<void>;
    delete: (id: string) => Promise<void>;
    moveDocuments: (params: {
      docIds: string[];
      targetFolderId: string | null;
    }) => Promise<void>;
    moveFolder: (params: {
      folderId: string;
      targetParentId: string | null;
    }) => Promise<void>;
  };
  review: {
    getDocMetrics: () => Promise<DocReviewMetrics[]>;
  };
  sync: {
    getState: () => Promise<SyncState | null>;
    syncNow: () => Promise<void>;
    configure: (config: SyncConfig) => Promise<void>;
    bootstrap: (serverUrl: string, deviceName: string) => Promise<AuthBootstrapResponse>;
    registerWithToken: (serverUrl: string, adminToken: string, deviceName: string) => Promise<AuthRegisterResponse>;
    verifyToken: (serverUrl: string, token: string) => Promise<AuthVerifyResponse>;
    getConflicts: () => Promise<ConflictRecord[]>;
    resolveConflict: (id: number, resolution: "local" | "remote") => Promise<void>;
    onStateChange: (fn: (state: SyncState) => void) => () => void;
  };
}
