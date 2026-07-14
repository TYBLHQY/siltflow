import { create } from "zustand";
import { getDb, nowISO } from "../database";
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
  createFolder: (name: string, parentId?: string | null) => Promise<FolderItem | null>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveDocuments: (docIds: string[], targetFolderId: string | null) => Promise<void>;
  moveFolder: (folderId: string, targetParentId: string | null) => Promise<void>;
  refreshDocs: () => Promise<void>;
}

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

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  loading: false,
  loaded: false,

  loadFolders: async (force?: boolean) => {
    if (!force && get().loaded) return;
    set({ loading: true });
    try {
      const db = getDb();
      const rows = await db.getAllAsync<any>(
        "SELECT id, name, parent_id AS parentId, sort_order AS sortOrder FROM folders ORDER BY sort_order, name",
      );
      set({ folders: rows || [], loaded: true });
    } catch (err) {
      console.error("Failed to load folders:", err);
    } finally {
      set({ loading: false });
    }
  },

  createFolder: async (name, parentId = null) => {
    try {
      const db = getDb();
      const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = nowISO();
      await db.runAsync(
        "INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
        id, name, parentId, now, now,
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
    const db = getDb();
    const now = nowISO();
    await db.runAsync("UPDATE folders SET name = ?, updated_at = ? WHERE id = ?", name, now, id);
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
  },

  deleteFolder: async (id) => {
    const db = getDb();
    // Delete folder
    await db.runAsync("DELETE FROM folders WHERE id = ?", id);
    // Move documents from this folder to root
    const docStore = useDocumentStore.getState();
    const movedDocs = docStore.documents
      .filter((d) => d.folderId === id)
      .map((d) => ({ ...d, folderId: undefined }));
    for (const doc of movedDocs) {
      await db.runAsync(
        "UPDATE documents SET folder_id = NULL, updated_at = ? WHERE id = ?",
        nowISO(), doc.id,
      );
    }
    docStore.setDocuments(
      docStore.documents.map((d) =>
        d.folderId === id ? { ...d, folderId: undefined } : d,
      ),
    );
    set((s) => ({
      folders: s.folders.filter(
        (f) => f.id !== id && !isDescendantOf(s.folders, f.id, id),
      ),
    }));
  },

  moveDocuments: async (docIds, targetFolderId) => {
    const db = getDb();
    const now = nowISO();
    for (const docId of docIds) {
      await db.runAsync(
        "UPDATE documents SET folder_id = ?, updated_at = ? WHERE id = ?",
        targetFolderId, now, docId,
      );
    }
    const docs = useDocumentStore
      .getState()
      .documents.map((d) =>
        docIds.includes(d.id)
          ? { ...d, folderId: targetFolderId ?? undefined }
          : d,
      );
    useDocumentStore.getState().setDocuments(docs);
  },

  moveFolder: async (folderId, targetParentId) => {
    const db = getDb();
    const now = nowISO();
    await db.runAsync(
      "UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?",
      targetParentId, now, folderId,
    );
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === folderId ? { ...f, parentId: targetParentId } : f,
      ),
    }));
  },

  refreshDocs: async () => {
    const db = getDb();
    const rows = await db.getAllAsync<any>(
      "SELECT id, title, total_pages AS totalPages, folder_id AS folderId, sort_order AS sortOrder FROM documents ORDER BY sort_order, created_at",
    );
    useDocumentStore.getState().setDocuments(rows || []);
  },
}));
