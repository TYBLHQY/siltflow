/// <reference types="vite/client" />

interface SiltflowAPI {
  vaultGetPath: () => Promise<string>
  vaultSelect: () => Promise<string>
  vaultConfigGet: () => Promise<Record<string, unknown>>
  vaultConfigSet: (config: Record<string, unknown>) => Promise<void>
  selectPdf: () => Promise<{ id: string; fileName: string; filePath: string; title: string } | null>
  loadFile: (filePath: string) => Promise<ArrayBuffer>
  documents: {
    list: () => Promise<any[]>
    get: (id: string) => Promise<any | null>
    save: (doc: any) => Promise<any>
    delete: (id: string) => Promise<void>
  }
  annotations: {
    list: (documentId: string) => Promise<any[]>
    save: (annotation: any) => Promise<any>
    delete: (id: string) => Promise<void>
  }
  summaries: {
    get: (documentId: string) => Promise<any | null>
    save: (summary: { documentId: string; text: string; isAiGenerated: boolean }) => Promise<any>
    delete: (documentId: string) => Promise<void>
  }
}

interface Window {
  siltflow: SiltflowAPI
}
