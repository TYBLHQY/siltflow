import type { DocumentItem } from "@/stores/document.store";
import type { FolderItem } from "@/stores/folder.store";

// ---------------------------------------------------------------------------
// Tree node data
// ---------------------------------------------------------------------------

export type NodeType = "folder" | "document";

export interface NodeData {
  id: string;
  name: string;
  children?: NodeData[];
  type: NodeType;
  originalId: string;
  doc?: DocumentItem;
  folder?: FolderItem;
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

export type ContextMenu =
  | { type: "document"; target: DocumentItem; x: number; y: number }
  | { type: "folder"; target: FolderItem; x: number; y: number }
  | { type: "empty"; x: number; y: number };
