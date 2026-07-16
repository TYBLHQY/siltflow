/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface SiltflowAPI {
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

  // Updates
  update: {
    check: () => Promise<void>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    onAvailable: (fn: (info: unknown) => void) => () => void;
    onNotAvailable: (fn: () => void) => () => void;
    onDownloadProgress: (
      fn: (progress: {
        percent: number;
        bytesPerSecond: number;
        total: number;
        transferred: number;
      }) => void,
    ) => () => void;
    onDownloaded: (fn: () => void) => () => void;
    onError: (fn: (message: string) => void) => () => void;
  };
  documents: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    list: () => Promise<any[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (id: string) => Promise<any | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    save: (doc: any) => Promise<any>;
    updateMetadata: (params: {
      id: string;
      totalPages: number;
      metadata: string;
    }) => Promise<void>;
    delete: (id: string) => Promise<void>;
    rename: (params: { id: string; title: string }) => Promise<void>;
  };
  annotations: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    list: (documentId: string) => Promise<any[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listAll: () => Promise<any[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    save: (annotation: any) => Promise<any>;
    delete: (id: string, documentId: string) => Promise<void>;
  };
  summaries: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listAll: () => Promise<any[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (documentId: string) => Promise<any | null>;
    save: (summary: {
      documentId: string;
      text: string;
      isAiGenerated: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) => Promise<any>;
    delete: (documentId: string) => Promise<void>;
  };
  aiResults: {
    get: (annotationId: string, documentId: string) => Promise<string | null>;
    listByDocument: (documentId: string) => Promise<{ annotationId: string; data: string }[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    save: (annotationId: string, documentId: string, data: any) => Promise<any>;
    delete: (annotationId: string, documentId: string) => Promise<void>;
  };
  fsrsCards: {
    get: (annotationId: string, documentId: string) => Promise<string | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    save: (annotationId: string, documentId: string, data: any) => Promise<any>;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) => Promise<any[]>;
    listAll: () => Promise<
      {
        id: string;
        annotationId: string;
        documentId: string;
        data: string;
        createdAt: string;
      }[]
    >;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    save: (annotationId: string, documentId: string, data: any) => Promise<any>;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    list: () => Promise<any[]>;
    create: (params: {
      name: string;
      parentId?: string | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) => Promise<any>;
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
    getDocMetrics: () => Promise<import("@/lib/doc-review").DocReviewMetrics[]>;
  };
}

interface Window {
  siltflow: SiltflowAPI;
}
