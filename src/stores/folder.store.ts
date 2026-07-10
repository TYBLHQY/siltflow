import { create } from "zustand"
import { useDocumentStore } from "./document.store"

export interface FolderItem {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
}

interface FolderState {
  folders: FolderItem[]
  loading: boolean
  loaded: boolean
  loadFolders: (force?: boolean) => Promise<void>
  createFolder: (name: string, parentId?: string | null) => Promise<FolderItem | null>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  moveDocuments: (docIds: string[], targetFolderId: string | null) => Promise<void>
  moveFolder: (folderId: string, targetParentId: string | null) => Promise<void>
  refreshDocs: () => Promise<void>
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  loading: false,
  loaded: false,

  loadFolders: async (force?: boolean) => {
    if (!force && get().loaded) return
    set({ loading: true })
    try {
      const folders = await window.siltflow.folders.list()
      set({ folders: folders || [], loaded: true })
    } catch (err) {
      console.error("Failed to load folders:", err)
    } finally {
      set({ loading: false })
    }
  },

  createFolder: async (name, parentId = null) => {
    try {
      const folder = await window.siltflow.folders.create({ name, parentId })
      if (folder) {
        set((s) => ({ folders: [...s.folders, folder] }))
      }
      return folder
    } catch (err) {
      console.error("Failed to create folder:", err)
      return null
    }
  },

  renameFolder: async (id, name) => {
    await window.siltflow.folders.rename({ id, name })
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }))
  },

  deleteFolder: async (id) => {
    await window.siltflow.folders.delete(id)
    // Remove from local state — backend moved docs to root, so reload
    const docs = await window.siltflow.documents.list()
    useDocumentStore.getState().setDocuments(docs || [])
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id && !isDescendantOf(s.folders, f.id, id)),
    }))
  },

  moveDocuments: async (docIds, targetFolderId) => {
    await window.siltflow.folders.moveDocuments({ docIds, targetFolderId })
    // Optimistic update local state
    const docs = useDocumentStore.getState().documents.map((d) =>
      docIds.includes(d.id) ? { ...d, folderId: targetFolderId ?? undefined } : d,
    )
    useDocumentStore.getState().setDocuments(docs)
  },

  moveFolder: async (folderId, targetParentId) => {
    await window.siltflow.folders.moveFolder({ folderId, targetParentId })
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === folderId ? { ...f, parentId: targetParentId } : f,
      ),
    }))
  },

  refreshDocs: async () => {
    const docs = await window.siltflow.documents.list()
    useDocumentStore.getState().setDocuments(docs || [])
  },
}))

function isDescendantOf(folders: FolderItem[], childId: string, ancestorId: string): boolean {
  let current = folders.find((f) => f.id === childId)
  while (current) {
    if (current.parentId === ancestorId) return true
    current = current.parentId ? folders.find((f) => f.id === current!.parentId) : undefined
  }
  return false
}
