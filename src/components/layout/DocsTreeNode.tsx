import { useCallback, useEffect, useRef } from "react";
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import type { NodeRendererProps } from "react-arborist";
import { useDocumentStore } from "@/stores/document.store";
import { useFolderStore } from "@/stores/folder.store";
import type { NodeData } from "./DocsTree.types";

export interface DocTreeNodeProps extends NodeRendererProps<NodeData> {
  onContextMenu: (e: React.MouseEvent, nodeData: NodeData) => void;
}

export function DocTreeNode({
  node,
  style,
  dragHandle,
  onContextMenu,
}: DocTreeNodeProps) {
  const setCurrentDocument = useDocumentStore((s) => s.setCurrentDocument);

  // For folder rename/escape — access store statically so no subscription overhead
  const handleDeleteFolder = useCallback(
    (folderId: string) => useFolderStore.getState().deleteFolder(folderId),
    [],
  );

  // Auto-focus (and select the name) when entering inline rename mode.
  // Declared before the early return so the hook order is stable across renders.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (node.isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [node.isEditing]);

  const data = node.data;
  if (!data) return null;

  const isSelected = node.isSelected;

  return (
    <div
      style={{
        ...style,
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
      ref={dragHandle}
      className={`w-full cursor-pointer ${
        isSelected ? "bg-ctp-surface0" : "hover:bg-ctp-surface0/50"
      }`}
      onPointerDown={(e) => {
        // Prevent react-arborist's native selection on click
        e.stopPropagation();
      }}
      onClick={(e) => {
        // Let modifier clicks (Ctrl/Cmd, Shift) propagate to react-arborist's built-in multi-select handler
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          return;
        }
        e.stopPropagation();
        if (data.type === "folder") {
          node.toggle();
        } else if (data.type === "document" && data.doc) {
          // Dedup: re-clicking the already-open doc is a no-op — skip the viewer
          // scale reset / re-sync (same guard as the Review list and deep links).
          if (useDocumentStore.getState().currentDocument?.id === data.doc.id) {
            return;
          }
          setCurrentDocument(data.doc);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, data)}
    >
      {data.type === "folder" ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
          className="flex items-center justify-center h-5 w-5 rounded hover:bg-ctp-surface0 shrink-0"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform text-ctp-overlay0 ${node.isOpen ? "rotate-90" : ""}`}
          />
        </button>
      ) : (
        <span className="inline-block w-5 shrink-0" />
      )}

      {data.type === "folder" ? (
        node.isOpen ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-ctp-overlay0" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-ctp-overlay0" />
        )
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-ctp-overlay0" />
      )}

      {node.isEditing ? (
        <input
          ref={inputRef}
          className="flex-1 min-w-0 rounded border border-ctp-mauve bg-ctp-base px-1 py-0 text-xs outline-none"
          defaultValue={data.name}
          // Clicks on the rename input must not bubble to the row's open/toggle
          // handler — otherwise editing a doc row would open the document.
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}

          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val) {
              node.submit(val);
            } else {
              // Revert to original name on blur
              node.reset();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = (e.target as HTMLInputElement).value.trim();
              if (!val) {
                e.preventDefault();
                return; // ignore empty name on Enter
              }
              node.submit(val);
            }
            if (e.key === "Escape") {
              const id = node.id;
              node.reset();
              // If it's a newly created folder (empty name), delete it
              if (id.startsWith("folder:") && !data.name && data.folder) {
                void handleDeleteFolder(id.slice(7));
              }
            }
          }}
        />
      ) : (
        <span
          className={`truncate min-w-0 flex-1 text-sm ${
            isSelected ? "text-ctp-mauve" : ""
          }`}
          style={{ width: 0 }}
          title={data.name}
        >
          {data.name}
        </span>
      )}
    </div>
  );
}
