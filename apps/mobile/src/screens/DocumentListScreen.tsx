import { useEffect, useState } from "react";
import { useDocumentStore, type DocumentItem } from "../stores/document.store";
import { useFolderStore, type FolderItem } from "../stores/folder.store";

export default function DocumentListScreen() {
  const documents = useDocumentStore((s) => s.documents);
  const loading = useDocumentStore((s) => s.loading);
  const loaded = useDocumentStore((s) => s.loaded);
  const loadFromDb = useDocumentStore((s) => s.loadFromDb);
  const folders = useFolderStore((s) => s.folders);
  const loadFolders = useFolderStore((s) => s.loadFolders);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loaded) loadFromDb();
    loadFolders();
  }, [loaded, loadFromDb, loadFolders]);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rootDocs = documents.filter((d) => !d.folderId);
  const rootFolders = folders.filter((f) => !f.parentId);

  if (loading && !loaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!loading && loaded && documents.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <FileText className="size-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">No documents yet</p>
        <p className="text-xs text-muted-foreground mt-1">Sync from desktop to get started</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-16">
      <h1 className="text-lg font-semibold text-foreground mb-4">Documents</h1>

      <div className="space-y-1">
        {rootFolders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            documents={documents}
            folders={folders}
            expanded={expandedFolders.has(folder.id)}
            onToggle={() => toggleFolder(folder.id)}
            depth={0}
          />
        ))}

        {rootDocs.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} />
        ))}
      </div>
    </div>
  );
}

function FolderRow({
  folder, documents, folders, expanded, onToggle, depth,
}: {
  folder: FolderItem;
  documents: DocumentItem[];
  folders: FolderItem[];
  expanded: boolean;
  onToggle: () => void;
  depth: number;
}) {
  const childFolders = folders.filter((f) => f.parentId === folder.id);
  const childDocs = documents.filter((d) => d.folderId === folder.id);

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <span className="text-xs text-muted-foreground transition-transform">
          {expanded ? "▼" : "▶"}
        </span>
        <span>{folder.name}</span>
        <span className="text-xs text-muted-foreground ml-auto">{childDocs.length}</span>
      </button>

      {expanded && (
        <div>
          {childFolders.map((cf) => (
            <FolderRow key={cf.id} folder={cf} documents={documents} folders={folders} expanded={false} onToggle={() => {}} depth={depth + 1} />
          ))}
          {childDocs.map((doc) => (<DocumentRow key={doc.id} doc={doc} depth={depth + 1} />))}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc, depth = 0 }: { doc: DocumentItem; depth?: number }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors cursor-pointer"
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      <FileText className="size-4 text-muted-foreground shrink-0" />
      <span className="truncate">{doc.title}</span>
    </div>
  );
}

function FileText({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
