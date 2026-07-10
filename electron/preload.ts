import { ipcRenderer, contextBridge } from 'electron'

export interface SiltflowAPI {
  vaultGetPath: () => Promise<string>
  vaultSelect: () => Promise<string>
  vaultSetPath: (vaultPath: string) => Promise<string>
  vaultConfigGet: () => Promise<Record<string, unknown>>
  vaultConfigSet: (config: Record<string, unknown>) => Promise<void>
  selectPdf: () => Promise<{ id: string; fileName: string; filePath: string; title: string } | null>
  loadFile: (filePath: string) => Promise<ArrayBuffer>

  // Database
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
  aiResults: {
    get: (annotationId: string, documentId: string) => Promise<string | null>
    save: (annotationId: string, documentId: string, data: any) => Promise<any>
    delete: (annotationId: string, documentId: string) => Promise<void>
  }
  fsrsCards: {
    get: (annotationId: string, documentId: string) => Promise<string | null>
    save: (annotationId: string, documentId: string, data: any) => Promise<any>
    delete: (annotationId: string, documentId: string) => Promise<void>
  }
  tts: {
    speak: (text: string, options?: { voice?: string; rate?: string; volume?: string; pitch?: string; binaryPath?: string }) => Promise<number[]>
    listVoices: (binaryPath?: string) => Promise<string[]>
  }
}

const api: SiltflowAPI = {
  vaultGetPath: () => ipcRenderer.invoke('vault:getPath'),
  vaultSelect: () => ipcRenderer.invoke('vault:select'),
  vaultSetPath: (vaultPath: string) => ipcRenderer.invoke('vault:setPath', vaultPath),
  vaultConfigGet: () => ipcRenderer.invoke('vault:config:get'),
  vaultConfigSet: (config) => ipcRenderer.invoke('vault:config:set', config),
  selectPdf: () => ipcRenderer.invoke('dialog:selectPdf'),
  loadFile: (filePath: string) => ipcRenderer.invoke('file:load', filePath),
  documents: {
    list: () => ipcRenderer.invoke('documents:list'),
    get: (id) => ipcRenderer.invoke('documents:get', id),
    save: (doc) => ipcRenderer.invoke('documents:save', doc),
    delete: (id) => ipcRenderer.invoke('documents:delete', id),
  },
  annotations: {
    list: (documentId) => ipcRenderer.invoke('annotations:list', documentId),
    save: (annotation) => ipcRenderer.invoke('annotations:save', annotation),
    delete: (id) => ipcRenderer.invoke('annotations:delete', id),
  },
  summaries: {
    get: (documentId) => ipcRenderer.invoke('summaries:get', documentId),
    save: (summary) => ipcRenderer.invoke('summaries:save', summary),
    delete: (documentId) => ipcRenderer.invoke('summaries:delete', documentId),
  },
  aiResults: {
    get: (annotationId, documentId) => ipcRenderer.invoke('aiResults:get', annotationId, documentId),
    save: (annotationId, documentId, data) => ipcRenderer.invoke('aiResults:save', { annotationId, documentId, data }),
    delete: (annotationId, documentId) => ipcRenderer.invoke('aiResults:delete', annotationId, documentId),
  },
  fsrsCards: {
    get: (annotationId, documentId) => ipcRenderer.invoke('fsrsCards:get', annotationId, documentId),
    save: (annotationId, documentId, data) => ipcRenderer.invoke('fsrsCards:save', { annotationId, documentId, data }),
    delete: (annotationId, documentId) => ipcRenderer.invoke('fsrsCards:delete', annotationId, documentId),
  },
  tts: {
    speak: (text, options) => ipcRenderer.invoke('tts:speak', text, options ?? {}),
    listVoices: (binaryPath?: string) => ipcRenderer.invoke('tts:listVoices', binaryPath),
  },
}

contextBridge.exposeInMainWorld('siltflow', api)
