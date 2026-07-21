import { memo } from "react";
import { AITranslateCard } from "@/components/document/AITranslateCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { pdfScrollToHighlight } from "@/stores/pdf-viewer.store";
import type { SearchEntry } from "@/stores/search.store";

interface AnnotationSearchCardProps {
  entry: SearchEntry | null;
  isWide: boolean;
}

/**
 * Detail card panel for viewing a full annotation in the search dialog.
 *
 * - Wide (&gt;= 768px): rendered as a side panel (always visible, fixed split)
 * - Narrow (&lt; 768px): rendered as a full overlay
 */
export const AnnotationSearchCard = memo(function AnnotationSearchCard({
  entry,
  isWide,
}: AnnotationSearchCardProps) {
  // ── Empty state ──
  if (!entry) {
    const empty = (
      <div className="flex-1 flex items-center justify-center text-ctp-overlay0 text-sm">
        Select an annotation to view details
      </div>
    );

    if (isWide) {
      return (
        <div className="flex-1 min-w-0 h-full border-l border-ctp-overlay0/20 bg-ctp-base overflow-hidden flex flex-col">
          {empty}
        </div>
      );
    }
    return null;
  }

  const { annotation } = entry;

  const cardContent = (
    <div className="flex-1 min-h-0">
      <ScrollArea className="h-full">
        <div className="p-3">
          <AITranslateCard
            id={annotation.id}
            item={annotation}
            expanded
            collapsible={false}
            showFSRS
            showActionBar={false}
            // The search index doesn't carry sourceLang; for translated
            // items V1/V2 already expose it from AI data internally.
            onToggleExpand={() => {}}
            onDelete={() => {}}
            onTranslate={async () => {}}
            onGoToHighlight={
              annotation.kind !== "manual"
                ? () => pdfScrollToHighlight(annotation.id)
                : undefined
            }
          />
        </div>
      </ScrollArea>
    </div>
  );

  // ── Wide: side panel (always visible, no animation) ──
  if (isWide) {
    return (
      <div className="flex-1 min-w-0 h-full border-l border-ctp-overlay0/20 bg-ctp-base overflow-hidden flex flex-col">
        {cardContent}
      </div>
    );
  }

  // ── Narrow: overlay ──
  return (
    <div className="fixed inset-0 z-60 bg-ctp-base flex flex-col">
      {cardContent}
    </div>
  );
});
