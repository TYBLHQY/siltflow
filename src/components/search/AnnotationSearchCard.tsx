import { X, ArrowRight, FileText } from "lucide-react";
import { AITranslateCard } from "@/components/document/AITranslateCard";
import { pdfScrollToHighlight } from "@/stores/pdf-viewer.store";
import type { SearchEntry } from "@/stores/search.store";

interface AnnotationSearchCardProps {
  entry: SearchEntry;
  isWide: boolean;
  onClose: () => void;
  onJumpTo: () => void;
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
  onClose,
  onJumpTo,
}: AnnotationSearchCardProps) {
  const { annotation, documentTitle } = entry;

  const cardContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ctp-overlay0/20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-ctp-overlay0 shrink-0" />
          <span className="text-sm font-medium truncate">{documentTitle}</span>
          {annotation.pageNumber > 0 && (
            <span className="text-xs text-ctp-overlay0 bg-ctp-surface0/60 px-1.5 py-0.5 rounded">
              p{annotation.pageNumber}
            </span>
          )}
        </div>
        <button
          className="rounded-sm p-1 hover:bg-ctp-surface0 transition-colors"
          onClick={onClose}
          title="Close card"
        >
          <X className="h-4 w-4 text-ctp-overlay0" />
        </button>
      </div>

      {/* Card content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <AITranslateCard
          id={annotation.id}
          item={annotation}
          expanded
          collapsible={false}
          showFSRS
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

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-ctp-overlay0/20">
        <button
          className="inline-flex items-center gap-1.5 text-sm text-ctp-mauve hover:underline"
          onClick={onJumpTo}
        >
          <ArrowRight className="h-4 w-4" />
          Jump to annotation
        </button>
      </div>
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
