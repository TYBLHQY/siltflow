import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Tree, type NodeRendererProps, type TreeApi } from "react-arborist";
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
    const key = f.parentId ?? "";
    if (key === "") {
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

  // Sort child folders within each parent group: sortOrder asc, then name asc
  const sortFolders = (a: FolderItem, b: FolderItem) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
  rootFolders.sort(sortFolders);
  for (const [, group] of childrenByParent) {
    group.sort(sortFolders);
  }

  // Pre-index: folderId → child documents (O(n))
  const docsByFolder = new Map<string, DocumentItem[]>();
  const rootDocs: DocumentItem[] = [];
  for (const d of documents) {
    const key = d.folderId ?? "";
    if (key === "") {
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

  // Sort child documents within each group: sortOrder asc, then title asc
  const sortDocs = (a: DocumentItem, b: DocumentItem) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title);
  rootDocs.sort(sortDocs);
  for (const [, group] of docsByFolder) {
    group.sort(sortDocs);
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
  /**
   * Focus the tree on a document: collapse every folder, open only the
   * document's ancestor path, then select and scroll it into view.
   */
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
      void useFolderStore.getState().loadFolders();
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

    // ── Reactive highlight of the current document ─────────────────────
    // The currently-open doc stays highlighted in the tree. When its folder path
    // is collapsed, walk up the ancestor chain and highlight the deepest *visible*
    // folder instead — so exactly one row is always marked, doc or folder.
    const computeHighlightId = useCallback((): string | null => {
      const doc = useDocumentStore.getState().currentDocument;
      if (!doc?.id) return null;
      // Doc's folder chain: direct parent first, root-level last.
      const folderChain: string[] = [];
      const seen = new Set<string>();
      let parentId = doc.folderId ?? null;
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        folderChain.push(parentId);
        const folder = useFolderStore
          .getState()
          .folders.find((f) => f.id === parentId);
        parentId = folder?.parentId ?? null;
      }
      const folderOpen = (folderId: string) =>
        tree?.isOpen(`folder:${folderId}`) ?? false;
      // Doc is visible iff every folder on its chain is open.
      if (folderChain.every(folderOpen)) return `doc:${doc.id}`;
      // Otherwise walk up: a folder row is visible iff its *ancestors* are open
      // (its own open state only governs its children). Pick the deepest folder
      // whose ancestors are all open — the nearest visible node.
      for (let i = 0; i < folderChain.length; i++) {
        if (folderChain.slice(i + 1).every(folderOpen)) {
          return `folder:${folderChain[i]}`;
        }
      }
      return null; // unreachable: the root-level folder is always visible
    }, [tree]);

    // Apply the highlight on mount and whenever the current doc (or the tree
    // data) changes. folders/documents are deps too: on the first mount the
    // folder tree may not have loaded yet, so this re-runs once it arrives.
    // select() scrolls the row into view; the target is always already visible,
    // so its scrollTo never force-expands collapsed folders. Default "smart"
    // align only scrolls when the row is out of view — clicking a doc that's
    // already on screen must not yank it to the viewport center.
    useEffect(() => {
      if (!tree) return;
      const id = computeHighlightId();
      if (!id) {
        if (tree.selectedIds.size > 0) tree.deselectAll();
        return;
      }
      // Skip when the highlight is already exactly right — folders/docs change
      // for unrelated reasons (first load, renames, drag-reorder), and
      // re-selecting then would re-scroll the list for no reason.
      if (tree.selectedIds.size === 1 && tree.selectedIds.has(id)) return;
      tree.select(id, { focus: false });
    }, [tree, currentDocument?.id, computeHighlightId, folders, documents]);

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
            void n.edit();
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
          // Collapse every folder so only the target's path stays open.
          tree.closeAll();
          // Open the doc's ancestor folders (root doc → no folders to open).
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
          void deleteFolder(folder.id);
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
            void n.edit();
            break;
          }
        }
        setContextMenu(null);
      },
      [tree],
    );
    const handleNewSubfolder = useCallback(
      (folder: FolderItem) => {
        void createDirectFolder(folder.id);
        setContextMenu(null);
      },
      [createDirectFolder],
    );
    const handleNewFolder = useCallback(() => {
      void createDirectFolder(null);
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
                // Dedup: activating the already-open doc must not re-open it.
                if (
                  found &&
                  found.id !== useDocumentStore.getState().currentDocument?.id
                ) {
                  setCurrentDocument(found);
                }
              }
            }}
            onToggle={() => {
              // Folders opening/closing can hide or reveal the current doc —
              // re-pick the deepest visible ancestor (or the doc itself) so a
              // visible row always stays highlighted.
              if (!tree) return;
              const id = computeHighlightId();
              if (!id) {
                tree.deselectAll();
                return;
              }
              // Set selection by id: select()'s get()/idToIndex check is stale
              // mid-toggle, and setSelection skips scrollTo's auto-open too.
              tree.setSelection({ ids: [id], anchor: id, mostRecent: id });
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
                    void n.edit();
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
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
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
