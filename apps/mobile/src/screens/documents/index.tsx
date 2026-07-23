/**
 * DocumentsScreen — main document list page.
 *
 * Assembles the search bar, folder filter, and document card list.
 * Handles four distinct render states:
 *   1. Loading — centred spinner while stores initialise
 *   2. Empty   — no documents in the database at all
 *   3. Filtered-empty — documents exist but none match the active filters
 *   4. Has data — scrollable list of DocumentCards
 */

import { useEffect, useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
} from "@/tw";
import { Spinner, EmptyState } from "@/components/ui";
import { useDocumentStore } from "@/stores/document.store";
import { useFolderStore } from "@/stores/folder.store";
import { useFolderTree } from "@/hooks/useFolderTree";
import { useDocumentFilter } from "@/hooks/useDocumentFilter";
import { SearchBar } from "./SearchBar";
import { FolderFilter } from "./FolderFilter";
import { DocumentCard } from "./DocumentCard";

// ── Component ────────────────────────────────────────────────────────

export function DocumentsScreen() {
  // ── Store subscriptions (per-field to minimise re-renders) ──
  const documents = useDocumentStore((s) => s.documents);
  const docsLoading = useDocumentStore((s) => s.loading);
  const docsLoaded = useDocumentStore((s) => s.loaded);
  const loadDocs = useDocumentStore((s) => s.loadFromDb);

  const folders = useFolderStore((s) => s.folders);
  const foldersLoaded = useFolderStore((s) => s.loaded);
  const loadFolders = useFolderStore((s) => s.loadFromDb);

  // ── Local UI state ────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderFilterExpanded, setFolderFilterExpanded] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  // ── Initialise stores on mount ────────────────────────────
  useEffect(() => {
    loadDocs();
    loadFolders();
  }, [loadDocs, loadFolders]);

  // ── Derived data ──────────────────────────────────────────
  const { flatList, nodeMap } = useFolderTree(folders);
  const filteredDocs = useDocumentFilter({
    documents,
    searchQuery,
    selectedFolderId,
    nodeMap,
  });

  // ── Derived render state ──────────────────────────────────
  const isLoading = docsLoading || !docsLoaded || !foldersLoaded;
  const isEmpty = !isLoading && documents.length === 0;
  const isFilteredEmpty = !isLoading && documents.length > 0 && filteredDocs.length === 0;

  // ── Handlers ──────────────────────────────────────────────
  function handleToggleExpand(folderId: string) {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  function handleSelectFolder(folderId: string | null) {
    setSelectedFolderId((prev) => (prev === folderId ? null : folderId));
  }

  function handleClearFilters() {
    setSearchQuery("");
    setSelectedFolderId(null);
  }

  function handleDocumentPress(_docId: string) {
    // Placeholder — will navigate to document detail in a future phase
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-ctp-base">
      {/* ── Header ──────────────────────────────────────────── */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-ctp-text">Documents</Text>
      </View>

      {/* ── Search & filter ─────────────────────────────────── */}
      <View className="px-4 pb-2 gap-2">
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        {folders.length > 0 && (
          <FolderFilter
            flatList={flatList}
            selectedFolderId={selectedFolderId}
            expandedIds={expandedFolderIds}
            isExpanded={folderFilterExpanded}
            onSelectFolder={handleSelectFolder}
            onToggleExpand={handleToggleExpand}
            onToggleSection={() => setFolderFilterExpanded((v) => !v)}
          />
        )}
      </View>

      {/* ── Body ────────────────────────────────────────────── */}
      <View className="h-px bg-ctp-surface0" />

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <Spinner size="lg" label="Loading documents..." />
        </View>
      )}

      {isEmpty && (
        <EmptyState
          title="No documents yet"
          description="Import a PDF to get started with reading and vocabulary building."
          action={{ label: "Import PDF", onPress: () => {} }}
        />
      )}

      {isFilteredEmpty && (
        <EmptyState
          title="No matching documents"
          description="Try adjusting your search or folder filter."
          action={{ label: "Clear filters", onPress: handleClearFilters }}
        />
      )}

      {!isLoading && !isEmpty && !isFilteredEmpty && (
        <ScrollView className="flex-1">
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onPress={() => handleDocumentPress(doc.id)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
