import { create } from "zustand";
import { getDb, nowISO } from "../database";

export interface DocumentItem {
  id: string;
  title: string;
  totalPages?: number | null;
  folderId?: string | null;
  sortOrder?: number;
}

interface DocumentState {
  documents: DocumentItem[];
  currentDocument: DocumentItem | null;
  loading: boolean;
  loaded: boolean;
  addDocument: (doc: DocumentItem) => Promise<void>;
  addDocuments: (docs: DocumentItem[]) => void;
  updateDocument: (id: string, patch: Partial<DocumentItem>) => Promise<void>;
  setCurrentDocument: (doc: DocumentItem | null) => void;
  removeDocument: (id: string) => Promise<void>;
  removeDocuments: (ids: string[]) => Promise<void>;
  setDocuments: (docs: DocumentItem[]) => void;
  loadFromDb: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  currentDocument: null,
  loading: false,
  loaded: false,

  addDocument: async (doc) => {
    const db = getDb();
    const now = nowISO();
    await db.runAsync(
      `INSERT OR REPLACE INTO documents (id, title, original_name, total_pages, metadata, folder_id, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      doc.id,
      doc.title,
      null,
      doc.totalPages ?? null,
      null,
      doc.folderId ?? null,
      doc.sortOrder ?? 0,
      now,
      now,
    );
    set((s) => ({ documents: [...s.documents, doc] }));
  },

  addDocuments: (docs) =>
    set((state) => ({ documents: [...state.documents, ...docs] })),

  updateDocument: async (id, patch) => {
    const db = getDb();
    const now = nowISO();
    const fields: string[] = [];
    const values: any[] = [];

    if (patch.title !== undefined) {
      fields.push("title = ?");
      values.push(patch.title);
    }
    if (patch.totalPages !== undefined) {
      fields.push("total_pages = ?");
      values.push(patch.totalPages);
    }
    if (patch.folderId !== undefined) {
      fields.push("folder_id = ?");
      values.push(patch.folderId);
    }
    if (patch.sortOrder !== undefined) {
      fields.push("sort_order = ?");
      values.push(patch.sortOrder);
    }

    if (fields.length > 0) {
      fields.push("updated_at = ?");
      values.push(now);
      values.push(id);
      await db.runAsync(
        `UPDATE documents SET ${fields.join(", ")} WHERE id = ?`,
        ...values,
      );
    }

    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, ...patch } : d,
      ),
      currentDocument:
        s.currentDocument?.id === id
          ? { ...s.currentDocument, ...patch }
          : s.currentDocument,
    }));
  },

  setCurrentDocument: (doc) => set({ currentDocument: doc }),

  removeDocument: async (id) => {
    const db = getDb();
    await db.runAsync("DELETE FROM documents WHERE id = ?", id);
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== id),
      currentDocument: s.currentDocument?.id === id ? null : s.currentDocument,
    }));
  },

  removeDocuments: async (ids) => {
    if (ids.length === 0) return;
    const db = getDb();
    const placeholders = ids.map(() => "?").join(",");
    await db.runAsync(
      `DELETE FROM documents WHERE id IN (${placeholders})`,
      ...ids,
    );
    set((s) => ({
      documents: s.documents.filter((d) => !ids.includes(d.id)),
      currentDocument:
        s.currentDocument && ids.includes(s.currentDocument.id)
          ? null
          : s.currentDocument,
    }));
  },

  setDocuments: (docs) => set({ documents: docs }),

  loadFromDb: async () => {
    set({ loading: true });
    try {
      const db = getDb();
      const rows = await db.getAllAsync<any>(
        "SELECT id, title, total_pages AS totalPages, folder_id AS folderId, sort_order AS sortOrder, original_name, metadata FROM documents ORDER BY sort_order, created_at",
      );
      set({ documents: rows || [], loaded: true });
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      set({ loading: false });
    }
  },

  setLoading: (loading) => set({ loading }),
}));
