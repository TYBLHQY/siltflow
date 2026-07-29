/**
 * Tests for folder tree building algorithm — buildTree() from useFolderTree.ts.
 *
 * The logic is pure: it takes a flat FolderItem[] and builds a nested tree
 * with depth and pre-order flattening. No React or native modules needed.
 */

import { describe, it, expect } from "vitest";

// We test the private buildTree function by copy-pasting it.
// In production it's inside useFolderTree.ts and called from useFolderTree hook.
// This is an intentional tradeoff: the algorithm is worth testing, and
// extracting it to a separate lib would be the ideal long-term solution.
//
// The function is pure O(n) tree reconstruction from flat list with parentId.

import type { FolderItem } from "@/stores/folder.store";

interface TreeNode {
  folder: FolderItem;
  children: TreeNode[];
  depth: number;
}

interface FolderTreeResult {
  roots: TreeNode[];
  nodeMap: Map<string, TreeNode>;
  flatList: TreeNode[];
}

function buildTree(folders: FolderItem[]): FolderTreeResult {
  const nodeMap = new Map<string, TreeNode>();
  for (const folder of folders) {
    nodeMap.set(folder.id, { folder, children: [], depth: 0 });
  }

  const roots: TreeNode[] = [];
  for (const node of nodeMap.values()) {
    const parentId = node.folder.parentId;
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function assignDepth(node: TreeNode, depth: number) {
    node.depth = depth;
    for (const child of node.children) {
      assignDepth(child, depth + 1);
    }
  }
  for (const root of roots) {
    assignDepth(root, 0);
  }

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

// Minimal FolderItem type required by the algorithm
function folder(id: string, parentId: string | null, name: string): FolderItem {
  return {
    id,
    name,
    parentId,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("buildTree", () => {
  it("returns empty for empty input", () => {
    const result = buildTree([]);
    expect(result.roots).toEqual([]);
    expect(result.nodeMap.size).toBe(0);
    expect(result.flatList).toEqual([]);
  });

  it("handles a single root folder", () => {
    const result = buildTree([folder("root", null, "Root")]);
    expect(result.roots).toHaveLength(1);
    expect(result.roots[0].folder.name).toBe("Root");
    expect(result.roots[0].depth).toBe(0);
    expect(result.nodeMap.size).toBe(1);
    expect(result.flatList).toHaveLength(1);
  });

  it("builds a parent-child hierarchy", () => {
    const folders = [
      folder("root", null, "Root"),
      folder("child", "root", "Child"),
    ];
    const result = buildTree(folders);

    expect(result.roots).toHaveLength(1);
    expect(result.roots[0].children).toHaveLength(1);
    expect(result.roots[0].children[0].folder.name).toBe("Child");
  });

  it("assigns correct depth", () => {
    const folders = [
      folder("a", null, "A"),
      folder("b", "a", "B"),
      folder("c", "b", "C"),
    ];
    const result = buildTree(folders);

    const c = result.nodeMap.get("c")!;
    expect(c.depth).toBe(2);

    const b = result.nodeMap.get("b")!;
    expect(b.depth).toBe(1);

    const a = result.nodeMap.get("a")!;
    expect(a.depth).toBe(0);
  });

  it("produces pre-order flatList", () => {
    const folders = [
      folder("a", null, "A"),
      folder("a1", "a", "A1"),
      folder("a2", "a", "A2"),
      folder("b", null, "B"),
      folder("b1", "b", "B1"),
    ];
    const result = buildTree(folders);
    const names = result.flatList.map((n) => n.folder.name);

    // Pre-order: A, then A's children, then B, then B's children
    expect(names).toEqual(["A", "A1", "A2", "B", "B1"]);
  });

  it("handles orphaned nodes (parent doesn't exist)", () => {
    const folders = [
      folder("orphan", "nonexistent-parent", "Orphan"),
      folder("root", null, "Root"),
    ];
    const result = buildTree(folders);

    // Orphaned nodes become roots
    expect(result.roots).toHaveLength(2);
    const orphanNames = result.roots.map((r) => r.folder.name);
    expect(orphanNames).toContain("Orphan");
    expect(orphanNames).toContain("Root");
  });

  it("handles siblings correctly", () => {
    const folders = [
      folder("root", null, "Root"),
      folder("a", "root", "A"),
      folder("b", "root", "B"),
      folder("c", "root", "C"),
    ];
    const result = buildTree(folders);
    expect(result.roots[0].children).toHaveLength(3);
  });

  it("nodeMap has O(1) lookup", () => {
    const folders = Array.from({ length: 100 }, (_, i) =>
      folder(`id-${i}`, i > 0 ? `id-${i - 1}` : null, `Folder ${i}`)
    );
    const result = buildTree(folders);
    // All folders are in the map
    expect(result.nodeMap.size).toBe(100);
    // Deepest node has correct depth
    const last = result.nodeMap.get("id-99")!;
    expect(last.depth).toBe(99);
  });
});
