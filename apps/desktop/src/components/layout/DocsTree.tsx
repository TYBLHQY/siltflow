import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import type { NodeRendererProps, TreeApi } from "react-arborist";
import { Tree } from "react-arborist";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useDocumentStore, type DocumentItem } from "@/stores/document.store";
import { useFolderStore, type FolderItem } from "@/stores/folder.store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DocTreeNode } from "./DocsTreeNode";
import type { NodeData, ContextMenu } from "./DocsTree.types";

// ---------------------------------------------------------------------------
// Build tree
// ---------------------------------------------------------------------------

function buildTree(
  folders: FolderItem[],
  documents: DocumentItem[],
): NodeData[] {
  // Pre-index: parentId → child folders (O(n))
  const childrenByParent = new Map<string, FolderItem[]>();
  const rootFolders: FolderItem[] = [];
  for (const f of folders) {
    const key = f.parentId ?? '';
    if (key === '') {
      rootFolders.push(f);
    } else {
      let list = childrenByParent.get(key);
      if (!list) {
        list = [];
        childrenByParent.set(key, list);
      }
      list.push(f);
    }
  }

  // Pre-index: folderId → child documents (O(n))
  const docsByFolder = new Map<string, DocumentItem[]>();
  const rootDocs: DocumentItem[] = [];
  for (const d of documents) {
    const key = d.folderId ?? '';
    if (key === '') {
      rootDocs.push(d);
    } else {
      let list = docsByFolder.get(key);
      if (!list) {
        list = [];
        docsByFolder.set(key, list);
      }
      list.push(d);
    }
  }

  function buildSubTree(folder: FolderItem): NodeData {
    const children: NodeData[] = [];

    // O(1) lookup: child folders
    const subFolders = childrenByParent.get(folder.id);
    if (subFolders) {
      for (const sf of subFolders) {
        children.push(buildSubTree(sf));
      }
    }

    // O(1) lookup: docs in this folder
    const folderDocs = docsByFolder.get(folder.id);
    if (folderDocs) {
      for (const doc of folderDocs) {
        children.push({
          id: `doc:${doc.id}`,
          name: doc.title,
          type: "document",
          originalId: doc.id,
          doc,
        });
      }
    }

    return {
      id: `folder:${folder.id}`,
      name: folder.name,
      children,
      type: "folder",
      originalId: folder.id,
      folder,
    };
  }

  const nodes: NodeData[] = [];

  // Root-level folders (O(1) lookup from pre-filtered array)
  for (const f of rootFolders) {
    nodes.push(buildSubTree(f));
  }

  // Root-level documents (O(1) lookup from pre-filtered array)
  for (const doc of rootDocs) {
    nodes.push({
      id: `doc:${doc.id}`,
      name: doc.title,
      type: "document",
      originalId: doc.id,
      doc,
    });
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// DocsTree component
// ---------------------------------------------------------------------------

export interface DocsTreeHandle {
  createFolder: () => void;
  /** Open parent folders and scroll/scroll to the document with the given id. */
  revealDocument: (docId: string) => void;
}

interface DocsTreeProps {
  /** Callback when a document is selected. If omitted, sets currentDocument on the store directly. */
  onSelectDocument?: (doc: DocumentItem) => void;
  /** Increment to force a fresh mount with initialOpenState (no expansion animation). */
  remountKey?: number;
}

export const DocsTree = forwardRef<DocsTreeHandle, DocsTreeProps>(
  function DocsTree(_props: DocsTreeProps, ref) {
    const documents = useDocumentStore((s) => s.documents);
    const currentDocument = useDocumentStore((s) => s.currentDocument);
    const setCurrentDocument = useDocumentStore((s) => s.setCurrentDocument);
    const removeDocument = useDocumentStore((s) => s.removeDocument);
    const updateDocument = useDocumentStore((s) => s.updateDocument);
    const folders = useFolderStore((s) => s.folders);
    const {
      createFolder,
      renameFolder,
      deleteFolder,
      moveDocuments,
      moveFolder,
    } = useFolderStore();
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<FolderItem | null>(null);
    const [tree, setTree] = useState<TreeApi<NodeData> | null>(null);
    const [treeHeight, setTreeHeight] = useState(200);

    // React 19: ref callback with cleanup — eliminates a useEffect for ResizeObserver.
    const containerRef = useCallback((el: HTMLDivElement | null) => {
      if (!el) return;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setTreeHeight(entry.contentRect.height);
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    // Load folders
    useEffect(() => {
      useFolderStore.getState().loadFolders();
    }, []);

    // Tree data
    const treeData = useMemo(
      () => buildTree(folders, documents),
      [folders, documents],
    );

    // Pre-compute which folders should be open on initial mount.
    // This avoids the visible "folded → expanded" animation when switching tabs.
    const initialOpenState = useMemo(() => {
      const state: Record<string, boolean> = {};
      if (!currentDocument?.folderId) return state;
      // Walk up the folder chain so nested folders also open.
      const seen = new Set<string>();
      let currentId: string | null | undefined = currentDocument.folderId;
      while (currentId && !seen.has(currentId)) {
        seen.add(currentId);
        state[`folder:${currentId}`] = true;
        const folder = folders.find((f) => f.id === currentId);
        currentId = folder?.parentId ?? null;
      }
      return state;
    }, [currentDocument?.folderId, folders]);

    // Select current doc after initial mount (or remount).
    const treeMountRef = useRef(false);
    useEffect(() => {
      if (!tree) return;
      if (!treeMountRef.current) {
        treeMountRef.current = true;
        if (currentDocument?.id) {
          tree.select(`doc:${currentDocument.id}`, { align: "center" });
        }
      }
    }, [tree, currentDocument?.id]);

    // Refresh both folders and docs
    const refreshAll = useCallback(async () => {
      await useFolderStore.getState().loadFolders(true);
      const freshDocs = await window.siltflow.documents.list();
      useDocumentStore.getState().setDocuments(freshDocs || []);
    }, []);

    // Create a folder directly, then trigger inline rename on it
    const createDirectFolder = useCallback(
      async (parentFolderId: string | null) => {
        const folder = await createFolder("", parentFolderId);
        if (!folder) return;
        // Reload to get the new folder into state
        await refreshAll();
        // Find the newly created folder node and start editing
        const treeNodes = tree?.visibleNodes ?? [];
        for (const n of treeNodes) {
          if (n.id === `folder:${folder.id}`) {
            n.edit();
            break;
          }
        }
      },
      [createFolder, tree, refreshAll],
    );

    // Ref: expose createFolder, revealDocument
    useImperativeHandle(
      ref,
      () => ({
        createFolder: async () => {
          await createDirectFolder(null);
        },
        revealDocument: (docId: string) => {
          if (!tree) return;
          // Find the doc in the documents list to learn its folderId
          const doc = documents.find((d) => d.id === docId);
          if (!doc) return;
          // Open all parent folders
          if (doc.folderId) {
            const openParents = (folderId: string) => {
              const folder = folders.find((f) => f.id === folderId);
              if (!folder) return;
              tree.open(`folder:${folderId}`);
              if (folder.parentId) openParents(folder.parentId);
            };
            openParents(doc.folderId);
          }
          // Select and scroll to the document
          tree.select(`doc:${docId}`, { align: "center" });
        },
      }),
      [createDirectFolder, tree, documents, folders],
    );

    // onRename: persist the new name for folders and documents
    const handleRename = useCallback(
      async ({ id, name }: { id: string; name: string }) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (id.startsWith("folder:")) {
          await renameFolder(id.slice(7), trimmed);
        } else if (id.startsWith("doc:")) {
          const docId = id.slice(4);
          await window.siltflow.documents.rename({ id: docId, title: trimmed });
          updateDocument(docId, { title: trimmed });
        }
      },
      [renameFolder, updateDocument],
    );

    // onCreate: required by react-arborist for tree.create() — we don't use it
    const handleCreate = useCallback(() => null as NodeData | null, []);

    // onMove: drag-and-drop
    const handleMove = useCallback(
      async ({
        dragIds,
        parentId,
      }: {
        dragIds: string[];
        parentId: string | null;
        index: number;
      }) => {
        const targetFolderId = parentId?.startsWith("folder:")
          ? parentId.slice(7)
          : null;
        const docIds: string[] = [];
        const folderIds: string[] = [];
        for (const id of dragIds) {
          if (id.startsWith("doc:")) docIds.push(id.slice(4));
          if (id.startsWith("folder:")) folderIds.push(id.slice(7));
        }
        if (docIds.length > 0) await moveDocuments(docIds, targetFolderId);
        for (const fid of folderIds) await moveFolder(fid, targetFolderId);
      },
      [moveDocuments, moveFolder],
    );

    // Context menu actions
    const handleDeleteDoc = useCallback(
      async (doc: DocumentItem) => {
        await window.siltflow.documents.delete(doc.id);
        removeDocument(doc.id);
        setContextMenu(null);
      },
      [removeDocument],
    );
    const handleDeleteFolder = useCallback(
      (folder: FolderItem) => {
        setContextMenu(null);
        // Count docs in this folder
        const docCount = documents.filter(
          (d) => d.folderId === folder.id,
        ).length;
        // Count subfolders recursively
        let subFolderCount = 0;
        const countSubfolders = (parentId: string) => {
          for (const f of folders) {
            if (f.parentId === parentId) {
              subFolderCount++;
              countSubfolders(f.id);
            }
          }
        };
        countSubfolders(folder.id);
        // If folder is empty, delete without confirmation
        if (docCount === 0 && subFolderCount === 0) {
          deleteFolder(folder.id);
        } else {
          setDeleteConfirm(folder);
        }
      },
      [documents, folders, deleteFolder],
    );
    const handleRenameFolder = useCallback(
      (folder: FolderItem) => {
        for (const n of tree?.visibleNodes ?? []) {
          if (n.id === `folder:${folder.id}`) {
            n.edit();
            break;
          }
        }
        setContextMenu(null);
      },
      [tree],
    );
    const handleNewSubfolder = useCallback(
      (folder: FolderItem) => {
        createDirectFolder(folder.id);
        setContextMenu(null);
      },
      [createDirectFolder],
    );
    const handleNewFolder = useCallback(() => {
      createDirectFolder(null);
      setContextMenu(null);
    }, [createDirectFolder]);

    // Dismiss context menu
    useEffect(() => {
      if (!contextMenu) return;
      const handler = () => setContextMenu(null);
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    }, [contextMenu]);

    // Node right-click
    const onNodeContextMenu = useCallback(
      (e: React.MouseEvent, nodeData: NodeData) => {
        e.preventDefault();
        e.stopPropagation();
        if (nodeData.type === "document" && nodeData.doc) {
          setContextMenu({
            type: "document",
            target: nodeData.doc,
            x: e.clientX,
            y: e.clientY,
          });
        } else if (nodeData.type === "folder" && nodeData.folder) {
          setContextMenu({
            type: "folder",
            target: nodeData.folder,
            x: e.clientX,
            y: e.clientY,
          });
        }
      },
      [],
    );

    // Empty area right-click on the tree container
    const onContainerContextMenu = useCallback((e: React.MouseEvent) => {
      // Only handle right-click on the container itself, not on tree items
      setContextMenu({ type: "empty", x: e.clientX, y: e.clientY });
    }, []);

    return (
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden"
        onContextMenu={onContainerContextMenu}
      >
        <div className="absolute inset-0">
          <Tree
            key={_props.remountKey ?? 0}
            data={treeData}
            onMove={handleMove}
            onRename={handleRename}
            onCreate={handleCreate}
            onActivate={(node) => {
              if (node.id.startsWith("doc:")) {
                const found = documents.find((d) => d.id === node.id.slice(4));
                if (found) {
                  setCurrentDocument(found);
                }
              }
            }}
            rowHeight={32}
            indent={16}
            openByDefault={false}
            initialOpenState={initialOpenState}
            width="100%"
            height={treeHeight}
            ref={(t) => setTree(t ?? null)}
          >
            {(props: NodeRendererProps<NodeData>) => (
              <DocTreeNode {...props} onContextMenu={onNodeContextMenu} />
            )}
          </Tree>
        </div>

        {contextMenu?.type === "document" && (
          <div
            className="fixed z-50 w-28 rounded-md border bg-ctp-surface0 p-1 shadow-md"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-ctp-surface0"
              onClick={() => {
                // Find the tree node and trigger inline edit
                for (const n of tree?.visibleNodes ?? []) {
                  if (n.id === `doc:${contextMenu.target.id}`) {
                    n.edit();
                    break;
                  }
                }
                setContextMenu(null);
              }}
            >
              <Pencil className="h-3 w-3" /> Rename
            </button>
            <hr className="my-1 border-ctp-overlay0/50" />
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-ctp-red transition-colors hover:bg-ctp-surface0"
              onClick={() => handleDeleteDoc(contextMenu.target)}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}

        {contextMenu?.type === "folder" && (
          <div
            className="fixed z-50 w-36 rounded-md border bg-ctp-surface0 p-1 shadow-md"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-ctp-surface0"
              onClick={() => handleNewSubfolder(contextMenu.target)}
            >
              <Plus className="h-3 w-3" /> Subfolder
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-ctp-surface0"
              onClick={() => handleRenameFolder(contextMenu.target)}
            >
              <Pencil className="h-3 w-3" /> Rename
            </button>
            <hr className="my-1 border-ctp-overlay0/50" />
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-ctp-red transition-colors hover:bg-ctp-surface0"
              onClick={() => handleDeleteFolder(contextMenu.target)}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}

        {contextMenu?.type === "empty" && (
          <div
            className="fixed z-50 w-36 rounded-md border bg-ctp-surface0 p-1 shadow-md"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-ctp-surface0"
              onClick={() => handleNewFolder()}
            >
              <Plus className="h-3 w-3" /> New Folder
            </button>
          </div>
        )}

        {/* ── Delete folder confirmation dialog ── */}
        <Dialog
          open={!!deleteConfirm}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirm(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Folder</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <strong>{deleteConfirm?.name}</strong>? All documents and
                subfolders inside it will be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (deleteConfirm) {
                    await deleteFolder(deleteConfirm.id);
                    setDeleteConfirm(null);
                  }
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
);
