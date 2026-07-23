/**
 * DocumentCard — a single document row in the documents list.
 *
 * Displays the document icon, title, metadata badges (pages, folder name),
 * and a relative timestamp. Supports tap and long-press interactions.
 *
 * Uses Unicode glyphs instead of SVG icons to avoid react-native-svg
 * native-module linking issues on the New Architecture.
 */

import { View, Text, Pressable } from "@/tw";
import { Badge } from "@/components/ui";
import type { EnrichedDocument } from "@/hooks/useDocumentFilter";
import { formatRelativeDate } from "@/hooks/useDocumentFilter";

// ── Props ────────────────────────────────────────────────────────────

export interface DocumentCardProps {
  document: EnrichedDocument;
  onPress: () => void;
  onLongPress?: () => void;
}

// ── Component ────────────────────────────────────────────────────────

export function DocumentCard({
  document: doc,
  onPress,
  onLongPress,
}: DocumentCardProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-row items-center px-4 py-3 border-b border-ctp-surface0 active:bg-ctp-surface0"
    >
      {/* ── Icon ───────────────────────────────────────────── */}
      <View
        className="mr-3 h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: "rgba(137,180,250,0.10)" }}
      >
        <Text className="text-base">📄</Text>
      </View>

      {/* ── Content ────────────────────────────────────────── */}
      <View className="flex-1">
        <Text
          className="text-base font-medium text-ctp-text"
          numberOfLines={1}
        >
          {doc.title || "Untitled Document"}
        </Text>

        <View className="mt-1 flex-row items-center gap-2">
          {doc.totalPages != null && doc.totalPages > 0 && (
            <Badge variant="secondary">{doc.totalPages} pages</Badge>
          )}
          {doc.folderName && (
            <Badge variant="outline">{doc.folderName}</Badge>
          )}
          <Text className="text-xs text-ctp-overlay1">
            {formatRelativeDate(doc.updatedAt)}
          </Text>
        </View>
      </View>

      {/* ── Chevron ────────────────────────────────────────── */}
      <Text className="ml-1 text-sm text-ctp-overlay1">›</Text>
    </Pressable>
  );
}
