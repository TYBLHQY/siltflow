/**
 * Sync client — connects to the desktop sync server over LAN.
 *
 * Sync direction:
 *   Desktop → Mobile: pull ALL data (documents, annotations, cards, etc.)
 *   Mobile → Desktop: push ONLY review_logs + fsrs_cards (learning progress)
 */
import { getDb } from "../database";
import * as FileSystem from "expo-file-system";

export class SyncClient {
  private baseUrl: string;

  constructor(host: string, port: number) {
    this.baseUrl = `http://${host}:${port}`;
  }

  // ====================================================================
  // Connection
  // ====================================================================

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/state`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getServerState(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/state`);
    return res.json();
  }

  // ====================================================================
  // Full pull — download everything from desktop
  // ====================================================================

  async fullPull() {
    const db = getDb();
    const counts: Record<string, number> = {};

    // Folders
    const folders = await this.fetchJson<any[]>("/api/folders");
    for (const f of folders) {
      await db.runAsync(
        `INSERT OR REPLACE INTO folders (id, name, parent_id, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        f.id, f.name, f.parent_id, f.sort_order, f.created_at, f.updated_at,
      );
    }
    counts.folders = folders.length;

    // Documents
    const docs = await this.fetchJson<any[]>("/api/documents");
    for (const d of docs) {
      await db.runAsync(
        `INSERT OR REPLACE INTO documents (id, title, original_name, total_pages, metadata, folder_id, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        d.id, d.title, d.original_name, d.total_pages, d.metadata, d.folder_id,
        d.sort_order, d.created_at, d.updated_at,
      );
    }
    counts.documents = docs.length;

    // PDFs (skip if already downloaded)
    for (const d of docs) {
      await this.downloadPdfIfMissing(d.id);
    }

    // Annotations
    const annotations = await this.fetchJson<any[]>("/api/annotations");
    for (const a of annotations) {
      await db.runAsync(
        `INSERT OR REPLACE INTO annotations (id, document_id, type, text, page_number, embed_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id, a.document_id, a.type, a.text, a.page_number, a.embed_data,
        a.created_at, a.updated_at,
      );
    }
    counts.annotations = annotations.length;

    // AI results
    const aiResults = await this.fetchJson<any[]>("/api/ai-results");
    for (const r of aiResults) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ai_results (annotation_id, document_id, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        r.annotation_id, r.document_id, r.data, r.created_at, r.updated_at,
      );
    }
    counts.aiResults = aiResults.length;

    // FSRS cards (pull from desktop first, but don't overwrite mobile's newer cards)
    const fsrsCards = await this.fetchJson<any[]>("/api/fsrs-cards");
    for (const c of fsrsCards) {
      // Only insert if not exists (desktop doesn't know mobile reviews yet)
      await db.runAsync(
        `INSERT OR IGNORE INTO fsrs_cards (annotation_id, document_id, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        c.annotation_id, c.document_id, c.data, c.created_at, c.updated_at,
      );
    }
    counts.fsrsCards = fsrsCards.length;

    // Review logs (desktop → mobile, append only)
    const reviewLogs = await this.fetchJson<any[]>("/api/review-logs");
    for (const l of reviewLogs) {
      await db.runAsync(
        `INSERT OR IGNORE INTO review_logs (id, annotation_id, document_id, data, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        l.id, l.annotation_id, l.document_id, l.data, l.created_at,
      );
    }
    counts.reviewLogs = reviewLogs.length;

    // Summaries
    const summaries = await this.fetchJson<any[]>("/api/summaries");
    for (const s of summaries) {
      await db.runAsync(
        `INSERT OR REPLACE INTO summaries (document_id, text, is_ai_generated, source_lang, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        s.document_id, s.text, s.is_ai_generated, s.source_lang,
        s.created_at, s.updated_at,
      );
    }
    counts.summaries = summaries.length;

    return counts;
  }

  // ====================================================================
  // PDF download (skip if exists)
  // ====================================================================

  async downloadPdfIfMissing(documentId: string): Promise<string | null> {
    const destDir = `${FileSystem.documentDirectory}pdfs/`;
    const destPath = `${destDir}${documentId}.pdf`;

    const info = await FileSystem.getInfoAsync(destPath);
    if (info.exists) return destPath;

    await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
    try {
      const result = await FileSystem.downloadAsync(
        `${this.baseUrl}/api/documents/pdf/${documentId}`,
        destPath,
      );
      return result.uri;
    } catch (err) {
      console.warn(`[sync] failed to download PDF ${documentId}:`, err);
      return null;
    }
  }

  getPdfPath(documentId: string): string {
    return `${FileSystem.documentDirectory}pdfs/${documentId}.pdf`;
  }

  // ====================================================================
  // Push — send ONLY review_logs + fsrs_cards back to desktop
  // Desktop owns documents/folders/annotations — mobile doesn't modify them
  // ====================================================================

  async pushLearningProgress() {
    const db = getDb();

    const [reviewLogs, fsrsCards] = await Promise.all([
      db.getAllAsync<any>(
        "SELECT id, annotation_id AS annotation_id, document_id AS document_id, data, created_at FROM review_logs",
      ),
      db.getAllAsync<any>(
        "SELECT annotation_id, document_id, data, created_at, updated_at FROM fsrs_cards",
      ),
    ]);

    const body: Record<string, any[]> = {};
    if (reviewLogs.length > 0) body.reviewLogs = reviewLogs;
    if (fsrsCards.length > 0) body.fsrsCards = fsrsCards;

    if (Object.keys(body).length === 0) return { pushed: 0 };

    const res = await fetch(`${this.baseUrl}/api/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // ====================================================================
  // Full sync = desktop→mobile pull + mobile→desktop learning progress
  // ====================================================================

  async fullSync() {
    const pullCounts = await this.fullPull();
    const pushResult = await this.pushLearningProgress();
    return { pull: pullCounts, push: pushResult };
  }

  // ====================================================================
  // Helper
  // ====================================================================

  private async fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`Sync fetch ${path}: ${res.status}`);
    return res.json();
  }
}
