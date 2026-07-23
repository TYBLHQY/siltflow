/**
 * useFolderTree — build a renderable tree from a flat FolderItem array.
 *
 * The folders table uses a self-referencing `parentId` column to model
 * hierarchy, but `foldersService.listFolders()` returns a flat list.
 * This hook reconstructs the tree client-side in O(n) time.
 */

import { useMemo } from "react";
import type { FolderItem } from "@/stores/folder.store";

// ── Types ────────────────────────────────────────────────────────────

export interface TreeNode {
  folder: FolderItem;
  children: TreeNode[];
  depth: number;
}

export interface FolderTreeResult {
  /** Top-level nodes (parentId === null or orphaned). */
  roots: TreeNode[];
  /** O(1) lookup by folder ID. */
  nodeMap: Map<string, TreeNode>;
  /** All nodes in pre-order, with depth for indentation rendering. */
  flatList: TreeNode[];
}

// ── Algorithm ────────────────────────────────────────────────────────

function buildTree(folders: FolderItem[]): FolderTreeResult {
  // Pass 1: create a TreeNode for every folder, store in Map
  const nodeMap = new Map<string, TreeNode>();
  for (const folder of folders) {
    nodeMap.set(folder.id, { folder, children: [], depth: 0 });
  }

  // Pass 2: link children to parents; orphaned nodes become roots
  const roots: TreeNode[] = [];
  for (const node of nodeMap.values()) {
    const parentId = node.folder.parentId;
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Pass 3: assign depth via DFS
  function assignDepth(node: TreeNode, depth: number) {
    node.depth = depth;
    for (const child of node.children) {
      assignDepth(child, depth + 1);
    }
  }
  for (const root of roots) {
    assignDepth(root, 0);
  }

  // Pass 4: flatten via pre-order traversal
  const flatList: TreeNode[] = [];
  function flatten(node: TreeNode) {
    flatList.push(node);
    for (const child of node.children) {
      flatten(child);
    }
  }
  for (const root of roots) {
    flatten(root);
  }

  return { roots, nodeMap, flatList };
}

// ── Hook ─────────────────────────────────────────────────────────────

/**
 * Build a folder tree from the flat folder list.
 *
 * The result is memoised on the folder array reference — it only
 * recomputes when folders are added, removed, or reordered.
 */
export function useFolderTree(folders: FolderItem[]): FolderTreeResult {
  return useMemo(() => buildTree(folders), [folders]);
}
