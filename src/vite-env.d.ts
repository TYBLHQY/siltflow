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
    list: () => Promise<any[]>;
    get: (id: string) => Promise<any | null>;
    save: (doc: any) => Promise<any>;
    updateMetadata: (params: {
      id: string;
      totalPages: number;
      metadata: string;
    }) => Promise<void>;
    delete: (id: string) => Promise<void>;
    deleteBatch: (ids: string[]) => Promise<void>;
    rename: (params: { id: string; title: string }) => Promise<void>;
  };
  annotations: {
    list: (documentId: string) => Promise<any[]>;
    listAll: () => Promise<any[]>;
    save: (annotation: any) => Promise<any>;
    delete: (id: string, documentId: string) => Promise<void>;
  };
  summaries: {
    get: (documentId: string) => Promise<any | null>;
    save: (summary: {
      documentId: string;
      text: string;
      isAiGenerated: boolean;
    }) => Promise<any>;
    delete: (documentId: string) => Promise<void>;
  };
  aiResults: {
    get: (annotationId: string, documentId: string) => Promise<string | null>;
    save: (annotationId: string, documentId: string, data: any) => Promise<any>;
    delete: (annotationId: string, documentId: string) => Promise<void>;
  };
  fsrsCards: {
    get: (annotationId: string, documentId: string) => Promise<string | null>;
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
    save: (annotationId: string, documentId: string, data: any) => Promise<any>;
    deleteByAnnotation: (annotationId: string, documentId: string) => Promise<void>;
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
    list: () => Promise<any[]>;
    create: (params: {
      name: string;
      parentId?: string | null;
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
    updateSortOrder: (
      items: { id: string; sortOrder: number }[],
    ) => Promise<void>;
    updateDocSortOrder: (
      items: { id: string; sortOrder: number }[],
    ) => Promise<void>;
  };
  review: {
    getAllCardsWithDocuments: () => Promise<Record<string, { title: string; cardData: string[]; annotationIds: string[] }>>;
  };
}

interface Window {
  siltflow: SiltflowAPI;
}
