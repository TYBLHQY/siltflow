import { AITranslateCard } from "@/components/document/AITranslateCard";
import { pdfScrollToHighlight } from "@/stores/pdf-viewer.store";
import type { SearchEntry } from "@/stores/search.store";

interface AnnotationSearchCardProps {
  entry: SearchEntry;
  isWide: boolean;
}

/**
 * Detail card panel for viewing a full annotation in the search dialog.
 *
 * - Wide (>= 768px): rendered as a side panel with slide-in animation
 * - Narrow (< 768px): rendered as a full overlay
 */
export function AnnotationSearchCard({
  entry,
  isWide,
}: AnnotationSearchCardProps) {
  const { annotation } = entry;

  const cardContent = (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <AITranslateCard
        id={annotation.id}
        item={annotation}
        expanded
        collapsible={false}
        showFSRS
        showActionBar={false}
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
  );

  // ── Wide: side panel ──
  if (isWide) {
    return (
      <div className="w-100 min-w-75 h-full border-l border-ctp-overlay0/20 bg-ctp-base animate-in slide-in-from-right duration-300 overflow-hidden flex flex-col">
        {cardContent}
      </div>
    );
  }

  // ── Narrow: overlay ──
  return (
    <div className="fixed inset-0 z-60 bg-ctp-base flex flex-col animate-in fade-in duration-200">
      {cardContent}
    </div>
  );
}
