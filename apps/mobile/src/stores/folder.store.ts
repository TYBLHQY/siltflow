/**
 * Folder store — mirrors desktop `stores/folder.store.ts`.
 *
 * Uses Drizzle-based folder service instead of window.siltflow IPC.
 */

import { create } from "zustand";
import { getDrizzle } from "@/stores/db.store";
import {
  listFolders,
  createFolder as createFolderSvc,
  renameFolder as renameFolderSvc,
  deleteFolder as deleteFolderSvc,
  moveDocuments as moveDocumentsSvc,
  moveFolder as moveFolderSvc,
  updateFoldersSortOrder,
} from "@/services/folders.service";
import type { FolderRowIPC } from "@/services/types";

export type FolderItem = FolderRowIPC;

interface FolderState {
  folders: FolderItem[];
  loading: boolean;
  loaded: boolean;

  setFolders: (folders: FolderItem[]) => void;
  loadFromDb: () => void;
  addFolder: (folder: FolderItem) => void;
  updateFolder: (id: string, patch: Partial<FolderItem>) => void;
  removeFolder: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  loading: false,
  loaded: false,

  setFolders: (folders) => set({ folders }),

  loadFromDb: () => {
    if (get().loaded) return;
    set({ loading: true });
    try {
      const db = getDrizzle();
      const folders = listFolders(db);
      set({ folders, loaded: true });
    } catch (err) {
      console.error("[folder.store] loadFromDb failed:", err);
    } finally {
      set({ loading: false });
    }
  },

  addFolder: (folder) =>
    set((s) => ({ folders: [...s.folders, folder] })),

  updateFolder: (id, patch) =>
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, ...patch } : f,
      ),
    })),

  removeFolder: (id) =>
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id),
    })),

  setLoading: (loading) => set({ loading }),
}));

// ── Action helpers ───────────────────────────────────────────────────

export function persistCreateFolder(name: string, parentId?: string | null) {
  try {
    const db = getDrizzle();
    const folder = createFolderSvc(db, { name, parentId });
    useFolderStore.getState().addFolder(folder);
    return folder;
  } catch (err) {
    console.error("[folder.store] persistCreateFolder failed:", err);
    return null;
  }
}

export function persistRenameFolder(id: string, name: string) {
  try {
    const db = getDrizzle();
    renameFolderSvc(db, id, name);
    useFolderStore.getState().updateFolder(id, { name });
  } catch (err) {
    console.error("[folder.store] persistRenameFolder failed:", err);
  }
}

export function persistDeleteFolder(id: string) {
  try {
    const db = getDrizzle();
    deleteFolderSvc(db, id);
    useFolderStore.getState().removeFolder(id);
  } catch (err) {
    console.error("[folder.store] persistDeleteFolder failed:", err);
  }
}

export function persistMoveDocuments(
  docIds: string[],
  targetFolderId: string | null,
) {
  try {
    const db = getDrizzle();
    moveDocumentsSvc(db, docIds, targetFolderId);
  } catch (err) {
    console.error("[folder.store] persistMoveDocuments failed:", err);
  }
}

export function persistMoveFolder(
  folderId: string,
  targetParentId: string | null,
) {
  try {
    const db = getDrizzle();
    moveFolderSvc(db, folderId, targetParentId);
  } catch (err) {
    console.error("[folder.store] persistMoveFolder failed:", err);
  }
}

export function persistUpdateFoldersSortOrder(
  items: { id: string; sortOrder: number }[],
) {
  try {
    const db = getDrizzle();
    updateFoldersSortOrder(db, items);
  } catch (err) {
    console.error("[folder.store] persistUpdateFoldersSortOrder failed:", err);
  }
}
