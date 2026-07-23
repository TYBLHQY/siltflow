/**
 * useDocumentFilter — filter and enrich documents for display.
 *
 * Applies two filter conditions:
 *   1. `searchQuery` — case-insensitive substring match on title
 *   2. `selectedFolderId` — subtree match (the folder AND all its descendants)
 *
 * Also enriches each document with its resolved `folderName` for display.
 */

import { useMemo } from "react";
import type { DocumentItem } from "@/stores/document.store";
import type { TreeNode } from "./useFolderTree";

// ── Types ────────────────────────────────────────────────────────────

export interface EnrichedDocument extends DocumentItem {
  /** Resolved folder name, or null when the document has no folder. */
  folderName: string | null;
}

export interface UseDocumentFilterParams {
  documents: DocumentItem[];
  searchQuery: string;
  selectedFolderId: string | null;
  nodeMap: Map<string, TreeNode>;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Collect all descendant folder IDs of `rootId` (including itself). */
function collectSubtreeIds(nodeMap: Map<string, TreeNode>, rootId: string): Set<string> {
  const ids = new Set<string>();
  function walk(id: string) {
    ids.add(id);
    const node = nodeMap.get(id);
    if (node) {
      for (const child of node.children) {
        walk(child.folder.id);
      }
    }
  }
  walk(rootId);
  return ids;
}

/**
 * Format an ISO date string as a relative time label.
 *
 * Examples: "just now", "5m ago", "3h ago", "2d ago", "Jan 15".
 */
function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export { formatRelativeDate };

// ── Hook ─────────────────────────────────────────────────────────────

export function useDocumentFilter({
  documents,
  searchQuery,
  selectedFolderId,
  nodeMap,
}: UseDocumentFilterParams): EnrichedDocument[] {
  return useMemo(() => {
    let result = documents;

    // Filter by folder (subtree match)
    if (selectedFolderId !== null) {
      const subtreeIds = collectSubtreeIds(nodeMap, selectedFolderId);
      result = result.filter((d) => {
        if (d.folderId === selectedFolderId) return true;
        if (d.folderId != null && subtreeIds.has(d.folderId)) return true;
        return false;
      });
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((d) => d.title.toLowerCase().includes(q));
    }

    // Enrich with folder name
    return result.map((d) => ({
      ...d,
      folderName: d.folderId ? (nodeMap.get(d.folderId)?.folder.name ?? null) : null,
    }));
  }, [documents, searchQuery, selectedFolderId, nodeMap]);
}
