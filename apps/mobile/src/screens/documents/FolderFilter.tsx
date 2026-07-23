/**
 * FolderFilter — collapsible folder tree for document filtering.
 *
 * Renders a "All Documents" header row that toggles a tree list of folders.
 * Each folder row is indented proportionally to its depth, shows expand/
 * collapse toggles for nested children, and highlights the active selection.
 *
 * Uses Unicode glyphs instead of SVG icons to avoid react-native-svg
 * native-module linking issues on the New Architecture.
 */

import { View, Text, Pressable } from "@/tw";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/hooks/useFolderTree";

// ── Props ────────────────────────────────────────────────────────────

export interface FolderFilterProps {
  flatList: TreeNode[];
  selectedFolderId: string | null;
  expandedIds: Set<string>;
  isExpanded: boolean;
  onSelectFolder: (folderId: string | null) => void;
  onToggleExpand: (folderId: string) => void;
  onToggleSection: () => void;
}

// ── Component ────────────────────────────────────────────────────────

export function FolderFilter({
  flatList,
  selectedFolderId,
  expandedIds,
  isExpanded,
  onSelectFolder,
  onToggleExpand,
  onToggleSection,
}: FolderFilterProps) {
  return (
    <View>
      {/* ── Section header ─────────────────────────────────── */}
      <Pressable
        onPress={onToggleSection}
        className="flex-row items-center gap-2 py-1"
      >
        <Text className="text-sm">📁</Text>
        <Text
          className={cn(
            "text-sm",
            selectedFolderId === null
              ? "font-semibold text-ctp-blue"
              : "text-ctp-subtext0",
          )}
        >
          All Documents
        </Text>
        <Text className="text-xs text-ctp-overlay1">
          {isExpanded ? "▼" : "▶"}
        </Text>
      </Pressable>

      {/* ── Tree list ──────────────────────────────────────── */}
      {isExpanded && (
        <View className="mt-1">
          {flatList.map((node) => {
            const { folder } = node;
            const isSelected = folder.id === selectedFolderId;
            const hasChildren = node.children.length > 0;
            const isNodeExpanded = expandedIds.has(folder.id);

            return (
              <Pressable
                key={folder.id}
                onPress={() => onSelectFolder(folder.id)}
                className={cn(
                  "flex-row items-center gap-2 rounded-md py-1.5 pr-2",
                  isSelected && "bg-ctp-blue/10",
                )}
                style={{ paddingLeft: 12 + node.depth * 16 }}
              >
                {/* Expand/collapse toggle for folders with children */}
                {hasChildren ? (
                  <Text
                    className="text-xs leading-none text-ctp-overlay1"
                    onPress={() => onToggleExpand(folder.id)}
                  >
                    {isNodeExpanded ? "▼" : "▶"}
                  </Text>
                ) : (
                  <View className="w-3" />
                )}

                <Text className="text-sm">
                  {isSelected || isNodeExpanded ? "📂" : "📁"}
                </Text>

                <Text
                  numberOfLines={1}
                  className="flex-1 text-sm text-ctp-subtext0"
                  style={isSelected ? { color: "#89b4fa" } : undefined}
                >
                  {folder.name || "Unnamed Folder"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
