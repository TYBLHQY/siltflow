import { useMemo, useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from "react"
import type {
  NodeRendererProps,
  TreeApi,
  NodeApi,
} from "react-arborist"
import { Tree } from "react-arborist"
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react"
import { useDocumentStore, type DocumentItem } from "@/stores/document.store"
import { useFolderStore, type FolderItem } from "@/stores/folder.store"

// ---------------------------------------------------------------------------
// Tree node data
// ---------------------------------------------------------------------------

type NodeType = "folder" | "document"

interface NodeData {
  id: string
  name: string
  children?: NodeData[]
  type: NodeType
  originalId: string
  doc?: DocumentItem
  folder?: FolderItem
}

// ---------------------------------------------------------------------------
// Build tree
// ---------------------------------------------------------------------------

function buildTree(folders: FolderItem[], documents: DocumentItem[]): NodeData[] {
  function buildSubTree(folder: FolderItem): NodeData {
    const children: NodeData[] = []
    for (const sf of folders.filter((f) => f.parentId === folder.id)) {
      children.push(buildSubTree(sf))
    }
    for (const doc of documents.filter((d) => d.folderId === folder.id)) {
      children.push({
        id: `doc:${doc.id}`,
        name: doc.title,
        type: "document",
        originalId: doc.id,
        doc,
      })
    }
    return {
      id: `folder:${folder.id}`,
      name: folder.name,
      children,
      type: "folder",
      originalId: folder.id,
      folder,
    }
  }

  const nodes: NodeData[] = []
  for (const f of folders.filter((f) => !f.parentId)) {
    nodes.push(buildSubTree(f))
  }
  for (const doc of documents.filter((d) => !d.folderId)) {
    nodes.push({
      id: `doc:${doc.id}`,
      name: doc.title,
      type: "document",
      originalId: doc.id,
      doc,
    })
  }
  return nodes
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

type ContextMenu =
  | { type: "document"; target: DocumentItem; x: number; y: number }
  | { type: "folder"; target: FolderItem; x: number; y: number }

// ---------------------------------------------------------------------------
// DocsTree component
// ---------------------------------------------------------------------------

export interface DocsTreeHandle {
  createFolder: () => void
}

interface DocsTreeProps {
  defaultParentId?: string | null
}

export const DocsTree = forwardRef<DocsTreeHandle, DocsTreeProps>(
  function DocsTree(_props: DocsTreeProps, ref) {
    const documents = useDocumentStore((s) => s.documents)
    const setCurrentDocument = useDocumentStore((s) => s.setCurrentDocument)
    const removeDocument = useDocumentStore((s) => s.removeDocument)
    const folders = useFolderStore((s) => s.folders)
    const { createFolder, renameFolder, deleteFolder, moveDocuments, moveFolder } =
      useFolderStore()
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
    const [tree, setTree] = useState<TreeApi<NodeData> | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [treeHeight, setTreeHeight] = useState(200)

    // Measure container height for react-arborist
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setTreeHeight(entry.contentRect.height)
        }
      })
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    // Load folders
    useEffect(() => {
      useFolderStore.getState().loadFolders()
    }, [])

    // Tree data
    const treeData = useMemo(() => buildTree(folders, documents), [folders, documents])

    // Ref: create folder via tree
    useImperativeHandle(
      ref,
      () => ({
        createFolder: () => {
          tree?.create({ parentId: null, index: 0 })
        },
      }),
      [tree],
    )

    // onCreate: persist folder immediately and return real data
    const handleCreate = useCallback(
      async (_args: {
        parentId: string | null
        index: number
        type: "internal" | "leaf"
      }): Promise<NodeData | null> => {
        const folder = await createFolder("")
        if (!folder) return null
        return {
          id: `folder:${folder.id}`,
          name: "",
          type: "folder",
          originalId: folder.id,
          folder,
        }
      },
      [createFolder],
    )

    // onRename: persist the new name
    const handleRename = useCallback(
      async ({ id, name }: { id: string; name: string }) => {
        if (id.startsWith("folder:")) {
          await renameFolder(id.slice(7), name)
        }
      },
      [renameFolder],
    )

    // onMove: drag-and-drop
    const handleMove = useCallback(
      async ({ dragIds, parentId }: { dragIds: string[]; parentId: string | null; index: number }) => {
        const targetFolderId = parentId?.startsWith("folder:") ? parentId.slice(7) : null
        const docIds: string[] = []
        const folderIds: string[] = []
        for (const id of dragIds) {
          if (id.startsWith("doc:")) docIds.push(id.slice(4))
          if (id.startsWith("folder:")) folderIds.push(id.slice(7))
        }
        if (docIds.length > 0) await moveDocuments(docIds, targetFolderId)
        for (const fid of folderIds) await moveFolder(fid, targetFolderId)
      },
      [moveDocuments, moveFolder],
    )

    // onSelect: open document on click
    const handleSelect = useCallback(
      (nodes: NodeApi<NodeData>[]) => {
        for (const node of nodes) {
          if (node.id.startsWith("doc:")) {
            const found = documents.find((d) => d.id === node.id.slice(4))
            if (found) {
              setCurrentDocument(found)
              return
            }
          }
        }
      },
      [documents, setCurrentDocument],
    )

    // Context menu actions
    const handleDeleteDoc = useCallback(
      async (doc: DocumentItem) => {
        await window.siltflow.documents.delete(doc.id)
        removeDocument(doc.id)
        setContextMenu(null)
      },
      [removeDocument],
    )
    const handleDeleteFolder = useCallback(
      async (folder: FolderItem) => {
        await deleteFolder(folder.id)
        setContextMenu(null)
      },
      [deleteFolder],
    )
    const handleRenameFolder = useCallback(
      (folder: FolderItem) => {
        for (const n of tree?.visibleNodes ?? []) {
          if (n.id === `folder:${folder.id}`) {
            n.edit()
            break
          }
        }
        setContextMenu(null)
      },
      [tree],
    )
    const handleNewSubfolder = useCallback(
      (folder: FolderItem) => {
        tree?.create({ parentId: `folder:${folder.id}`, index: 0 })
        setContextMenu(null)
      },
      [tree],
    )

    // Dismiss context menu
    useEffect(() => {
      if (!contextMenu) return
      const handler = () => setContextMenu(null)
      document.addEventListener("click", handler)
      return () => document.removeEventListener("click", handler)
    }, [contextMenu])

    // Node right-click
    const onNodeContextMenu = useCallback(
      (e: React.MouseEvent, nodeData: NodeData) => {
        e.preventDefault()
        e.stopPropagation()
        if (nodeData.type === "document" && nodeData.doc) {
          setContextMenu({ type: "document", target: nodeData.doc, x: e.clientX, y: e.clientY })
        } else if (nodeData.type === "folder" && nodeData.folder) {
          setContextMenu({ type: "folder", target: nodeData.folder, x: e.clientX, y: e.clientY })
        }
      },
      [],
    )

    return (
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden">
        <div className="absolute inset-0">
          <Tree
            data={treeData}
            onMove={handleMove}
            onRename={handleRename}
            onCreate={handleCreate}
            onSelect={handleSelect}
            rowHeight={32}
            indent={16}
            openByDefault={false}
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
          <div className="fixed z-50 w-28 rounded-md border bg-popover p-1 shadow-md"
            style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-accent"
              onClick={() => handleDeleteDoc(contextMenu.target)}>
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}

        {contextMenu?.type === "folder" && (
          <div className="fixed z-50 w-36 rounded-md border bg-popover p-1 shadow-md"
            style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent"
              onClick={() => handleNewSubfolder(contextMenu.target)}>
              <Plus className="h-3 w-3" /> Subfolder
            </button>
            <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent"
              onClick={() => handleRenameFolder(contextMenu.target)}>
              <Pencil className="h-3 w-3" /> Rename
            </button>
            <hr className="my-1 border-border/50" />
            <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-accent"
              onClick={() => handleDeleteFolder(contextMenu.target)}>
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}
      </div>
    )
  },
)

// ---------------------------------------------------------------------------
// Node renderer
// ---------------------------------------------------------------------------

interface DocTreeNodeProps extends NodeRendererProps<NodeData> {
  onContextMenu: (e: React.MouseEvent, nodeData: NodeData) => void
}

function DocTreeNode({ node, style, dragHandle, onContextMenu }: DocTreeNodeProps) {
  const data = node.data
  if (!data) return null

  return (
    <div
      style={{ ...style, height: "100%", display: "flex", alignItems: "center", gap: "6px" }}
      ref={dragHandle}
      className={`w-full cursor-pointer ${
        node.isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
      }`}
      onContextMenu={(e) => onContextMenu(e, data)}
    >
      {data.type === "folder" ? (
        <button
          onClick={(e) => { e.stopPropagation(); node.toggle() }}
          className="flex items-center justify-center h-5 w-5 rounded hover:bg-accent shrink-0"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform text-muted-foreground ${node.isOpen ? "rotate-90" : ""}`} />
        </button>
      ) : (
        <span className="inline-block w-5 shrink-0" />
      )}

      {data.type === "folder" ? (
        node.isOpen
          ? <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}

      {node.isEditing ? (
        <input
          className="flex-1 min-w-0 rounded border border-primary bg-background px-1 py-0 text-xs outline-none"
          defaultValue={data.name}
          autoFocus
          onBlur={(e) => node.submit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") node.submit((e.target as HTMLInputElement).value)
            if (e.key === "Escape") node.reset()
          }}
        />
      ) : (
        <span className="truncate min-w-0 flex-1 text-sm" style={{ width: 0 }}>{data.name}</span>
      )}
    </div>
  )
}
