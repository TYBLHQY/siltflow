import { create } from "zustand";
import { useDocumentStore } from "./document.store";

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

interface FolderState {
  folders: FolderItem[];
  loading: boolean;
  loaded: boolean;
  loadFolders: (force?: boolean) => Promise<void>;
  addFolders: (newFolders: FolderItem[]) => void;
  createFolder: (name: string, parentId?: string | null) => Promise<FolderItem | null>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveDocuments: (docIds: string[], targetFolderId: string | null) => Promise<void>;
  moveFolder: (folderId: string, targetParentId: string | null) => Promise<void>;
  refreshDocs: () => Promise<void>;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  loading: false,
  loaded: false,

  loadFolders: async (force?: boolean) => {
    if (!force && get().loaded) return;
    set({ loading: true });
    try {
      const { executeSql } = await import("../database");
      const folders = await executeSql("SELECT * FROM folders ORDER BY sort_order ASC");
      set({ folders: folders || [], loaded: true });
    } catch (err) {
      console.error("Failed to load folders:", err);
    } finally {
      set({ loading: false });
    }
  },

  addFolders: (newFolders: FolderItem[]) =>
    set((state) => ({
      folders: [...state.folders, ...newFolders],
    })),

  createFolder: async (name, parentId = null) => {
    try {
      const { runSql } = await import("../database");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await runSql(
        "INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
        [id, name, parentId, now, now],
      );
      const folder: FolderItem = { id, name, parentId, sortOrder: 0 };
      set((s) => ({ folders: [...s.folders, folder] }));
      return folder;
    } catch (err) {
      console.error("Failed to create folder:", err);
      return null;
    }
  },

  renameFolder: async (id, name) => {
    const { runSql } = await import("../database");
    await runSql("UPDATE folders SET name = ?, updated_at = ? WHERE id = ?", [
      name, new Date().toISOString(), id,
    ]);
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
  },

  deleteFolder: async (id) => {
    const { runSql, executeSql } = await import("../database");
    await runSql("DELETE FROM folders WHERE id = ?", [id]);
    const docs = await executeSql("SELECT * FROM documents ORDER BY sort_order ASC");
    useDocumentStore.getState().setDocuments(docs || []);
    set((s) => ({
      folders: s.folders.filter(
        (f) => f.id !== id && !isDescendantOf(s.folders, f.id, id),
      ),
    }));
  },

  moveDocuments: async (docIds, targetFolderId) => {
    const { runSql } = await import("../database");
    const store = useDocumentStore.getState();
    for (const docId of docIds) {
      await runSql("UPDATE documents SET folder_id = ?, updated_at = ? WHERE id = ?", [
        targetFolderId, new Date().toISOString(), docId,
      ]);
    }
    store.setDocuments(
      store.documents.map((d) =>
        docIds.includes(d.id)
          ? { ...d, folderId: targetFolderId ?? undefined }
          : d,
      ),
    );
  },

  moveFolder: async (folderId, targetParentId) => {
    const { runSql } = await import("../database");
    await runSql("UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?", [
      targetParentId, new Date().toISOString(), folderId,
    ]);
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === folderId ? { ...f, parentId: targetParentId } : f,
      ),
    }));
  },

  refreshDocs: async () => {
    const { executeSql } = await import("../database");
    const docs = await executeSql("SELECT * FROM documents ORDER BY sort_order ASC");
    useDocumentStore.getState().setDocuments(docs || []);
  },
}));

function isDescendantOf(
  folders: FolderItem[],
  childId: string,
  ancestorId: string,
): boolean {
  let current = folders.find((f) => f.id === childId);
  while (current) {
    if (current.parentId === ancestorId) return true;
    current = current.parentId
      ? folders.find((f) => f.id === current!.parentId)
      : undefined;
  }
  return false;
}
