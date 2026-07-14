import { ipcRenderer, contextBridge } from 'electron'

export interface SiltflowAPI {
  vaultGetPath: () => Promise<string>
  vaultSelect: () => Promise<string>
  vaultSetPath: (vaultPath: string) => Promise<string>
  vaultConfigGet: () => Promise<Record<string, unknown>>
  vaultConfigSet: (config: Record<string, unknown>) => Promise<void>
  openExternal: (url: string) => Promise<void>
  selectPdf: () => Promise<{ id: string; title: string }[] | null>
  importPdfFolder: () => Promise<{
    docs: { id: string; title: string; folderId: string | null }[]
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
    updateMetadata: (params: { id: string; totalPages: number; metadata: string }) => Promise<void>
    delete: (id: string) => Promise<void>
    deleteBatch: (ids: string[]) => Promise<void>
    rename: (params: { id: string; title: string }) => Promise<void>
  }
  annotations: {
    list: (documentId: string) => Promise<any[]>
    listAll: () => Promise<any[]>
    save: (annotation: any) => Promise<any>
    delete: (id: string, documentId: string) => Promise<void>
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
    listAll: () => Promise<{ annotationId: string; documentId: string; data: string; createdAt: string; updatedAt: string }[]>
  }
  reviewLogs: {
    listByAnnotation: (annotationId: string, documentId: string) => Promise<any[]>
    listAll: () => Promise<{ id: string; annotationId: string; documentId: string; data: string; createdAt: string }[]>
    save: (annotationId: string, documentId: string, data: any) => Promise<any>
    deleteByAnnotation: (annotationId: string, documentId: string) => Promise<void>
  }
  tts: {
    speak: (text: string, options?: { voice?: string; rate?: string; volume?: string; pitch?: string }) => Promise<number[]>
    listVoices: () => Promise<string[]>
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
  sync: {
    start: () => Promise<{ port?: number; error?: string }>
    stop: () => Promise<{ ok: boolean }>
    status: () => Promise<{ running: boolean; port: number }>
  }
  getNetworkIPs: () => Promise<string[]>
}

const api: SiltflowAPI = {
  vaultGetPath: () => ipcRenderer.invoke('vault:getPath'),
  vaultSelect: () => ipcRenderer.invoke('vault:select'),
  vaultSetPath: (vaultPath: string) => ipcRenderer.invoke('vault:setPath', vaultPath),
  vaultConfigGet: () => ipcRenderer.invoke('vault:config:get'),
  vaultConfigSet: (config) => ipcRenderer.invoke('vault:config:set', config),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
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
    updateMetadata: (params) => ipcRenderer.invoke('documents:updateMetadata', params),
    delete: (id) => ipcRenderer.invoke('documents:delete', id),
    deleteBatch: (ids) => ipcRenderer.invoke('documents:deleteBatch', ids),
    rename: (params) => ipcRenderer.invoke('documents:rename', params),
  },
  annotations: {
    list: (documentId) => ipcRenderer.invoke('annotations:list', documentId),
    listAll: () => ipcRenderer.invoke('annotations:listAll'),
    save: (annotation) => ipcRenderer.invoke('annotations:save', annotation),
    delete: (id, documentId) => ipcRenderer.invoke('annotations:delete', id, documentId),
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
    listAll: () => ipcRenderer.invoke('fsrsCards:listAll'),
  },
  reviewLogs: {
    listByAnnotation: (annotationId, documentId) => ipcRenderer.invoke('reviewLogs:listByAnnotation', annotationId, documentId),
    listAll: () => ipcRenderer.invoke('reviewLogs:listAll'),
    save: (annotationId, documentId, data) => ipcRenderer.invoke('reviewLogs:save', { annotationId, documentId, data }),
    deleteByAnnotation: (annotationId, documentId) => ipcRenderer.invoke('reviewLogs:deleteByAnnotation', annotationId, documentId),
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
    listVoices: () => ipcRenderer.invoke('tts:listVoices'),
  },
  sync: {
    start: () => ipcRenderer.invoke('sync:start'),
    stop: () => ipcRenderer.invoke('sync:stop'),
    status: () => ipcRenderer.invoke('sync:status'),
  },
  getNetworkIPs: () => ipcRenderer.invoke('network:ips'),
}

contextBridge.exposeInMainWorld('siltflow', api)
