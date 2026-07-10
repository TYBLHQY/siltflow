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
}

contextBridge.exposeInMainWorld('siltflow', api)
