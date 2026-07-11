import { ipcRenderer, contextBridge } from 'electron'

export interface SiltflowAPI {
  vaultGetPath: () => Promise<string>
  vaultSelect: () => Promise<string>
  vaultSetPath: (vaultPath: string) => Promise<string>
  vaultConfigGet: () => Promise<Record<string, unknown>>
  vaultConfigSet: (config: Record<string, unknown>) => Promise<void>
  selectPdf: () => Promise<{ id: string; fileName: string; filePath: string; title: string; originalName?: string }[] | null>
  importPdfFolder: () => Promise<{
    docs: { id: string; fileName: string; filePath: string; title: string; originalName?: string; folderId: string | null }[]
  } | null>
  loadFile: (filePath: string) => Promise<ArrayBuffer>

  // Updates
  update: {
    check: () => Promise<void>
    download: () => Promise<void>
    install: () => Promise<void>
    onAvailable: (fn: (info: unknown) => void) => () => void
    onNotAvailable: (fn: () => void) => () => void
    onDownloadProgress: (fn: (progress: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => void) => () => void
    onDownloaded: (fn: () => void) => () => void
    onError: (fn: (message: string) => void) => () => void
  }

  // Database
  documents: {
    list: () => Promise<any[]>
    get: (id: string) => Promise<any | null>
    save: (doc: any) => Promise<any>
    delete: (id: string) => Promise<void>
    deleteBatch: (ids: string[]) => Promise<void>
    rename: (params: { id: string; title: string }) => Promise<void>
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
    listByDocument: (documentId: string) => Promise<{ annotationId: string; data: string }[]>
  }
  tts: {
    speak: (text: string, options?: { voice?: string; rate?: string; volume?: string; pitch?: string; binaryPath?: string }) => Promise<number[]>
    listVoices: (binaryPath?: string) => Promise<string[]>
  }
  folders: {
    list: () => Promise<any[]>
    create: (params: { name: string; parentId?: string | null }) => Promise<any>
    rename: (params: { id: string; name: string }) => Promise<void>
    delete: (id: string) => Promise<void>
    moveDocuments: (params: { docIds: string[]; targetFolderId: string | null }) => Promise<void>
    moveFolder: (params: { folderId: string; targetParentId: string | null }) => Promise<void>
    updateSortOrder: (items: { id: string; sortOrder: number }[]) => Promise<void>
    updateDocSortOrder: (items: { id: string; sortOrder: number }[]) => Promise<void>
  }
}

const api: SiltflowAPI = {
  vaultGetPath: () => ipcRenderer.invoke('vault:getPath'),
  vaultSelect: () => ipcRenderer.invoke('vault:select'),
  vaultSetPath: (vaultPath: string) => ipcRenderer.invoke('vault:setPath', vaultPath),
  vaultConfigGet: () => ipcRenderer.invoke('vault:config:get'),
  vaultConfigSet: (config) => ipcRenderer.invoke('vault:config:set', config),
  selectPdf: () => ipcRenderer.invoke('dialog:selectPdf'),
  importPdfFolder: () => ipcRenderer.invoke('dialog:importPdfFolder'),
  loadFile: (filePath: string) => ipcRenderer.invoke('file:load', filePath),

  // Updates
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onAvailable: (fn) => {
      const cb = (_: unknown, info: unknown) => fn(info)
      ipcRenderer.on('update:available', cb)
      return () => ipcRenderer.removeListener('update:available', cb)
    },
    onNotAvailable: (fn) => {
      const cb = () => fn()
      ipcRenderer.on('update:not-available', cb)
      return () => ipcRenderer.removeListener('update:not-available', cb)
    },
    onDownloadProgress: (fn) => {
      const cb = (_: unknown, progress: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => fn(progress)
      ipcRenderer.on('update:download-progress', cb)
      return () => ipcRenderer.removeListener('update:download-progress', cb)
    },
    onDownloaded: (fn) => {
      const cb = () => fn()
      ipcRenderer.on('update:downloaded', cb)
      return () => ipcRenderer.removeListener('update:downloaded', cb)
    },
    onError: (fn) => {
      const cb = (_: unknown, message: string) => fn(message)
      ipcRenderer.on('update:error', cb)
      return () => ipcRenderer.removeListener('update:error', cb)
    },
  },
  documents: {
    list: () => ipcRenderer.invoke('documents:list'),
    get: (id) => ipcRenderer.invoke('documents:get', id),
    save: (doc) => ipcRenderer.invoke('documents:save', doc),
    delete: (id) => ipcRenderer.invoke('documents:delete', id),
    deleteBatch: (ids) => ipcRenderer.invoke('documents:deleteBatch', ids),
    rename: (params) => ipcRenderer.invoke('documents:rename', params),
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
    listByDocument: (documentId) => ipcRenderer.invoke('fsrsCards:listByDocument', documentId),
  },
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    create: (params: { name: string; parentId?: string | null }) => ipcRenderer.invoke('folders:create', params),
    rename: (params: { id: string; name: string }) => ipcRenderer.invoke('folders:rename', params),
    delete: (id: string) => ipcRenderer.invoke('folders:delete', id),
    moveDocuments: (params: { docIds: string[]; targetFolderId: string | null }) => ipcRenderer.invoke('folders:moveDocuments', params),
    moveFolder: (params: { folderId: string; targetParentId: string | null }) => ipcRenderer.invoke('folders:moveFolder', params),
    updateSortOrder: (items: { id: string; sortOrder: number }[]) => ipcRenderer.invoke('folders:updateSortOrder', items),
    updateDocSortOrder: (items: { id: string; sortOrder: number }[]) => ipcRenderer.invoke('documents:updateSortOrder', items),
  },
  tts: {
    speak: (text, options) => ipcRenderer.invoke('tts:speak', text, options ?? {}),
    listVoices: (binaryPath?: string) => ipcRenderer.invoke('tts:listVoices', binaryPath),
  },
}

contextBridge.exposeInMainWorld('siltflow', api)
