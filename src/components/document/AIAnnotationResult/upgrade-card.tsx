import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { AnnotationItem } from "@/stores/annotation.store";

interface AIAnnotationResultUpgradeCardProps {
  item: AnnotationItem;
  /** Show core: header + message + source text + action bar. */
  showCore?: boolean;
  /** Show action bar (the re-translate button). */
  showActionBar?: boolean;
  onTranslate?: () => void | Promise<void>;
  /** Source language — accepted for interface compatibility (unused here). */
  sourceLang?: string;
  // Accepted-but-unused for interface compatibility with AIAnnotationResultProps.
  showDetails?: boolean;
  enableShortcut?: boolean;
  onEditToggle?: () => void;
  editing?: boolean;
  onDelete?: () => void;
  onGoToHighlight?: () => void;
}

/**
 * Read-only card for legacy V1 annotations.
 *
 * The V1 schema has been removed from the codebase; a stale V1 row (ai_version=1
 * in the DB) renders through this card as an opaque "old data" prompt. The only
 * action is re-translating through the V2 pipeline. Text editing is deliberately
 * unavailable — the payload is treated as immutable legacy data.
 */
export function AIAnnotationResultUpgradeCard({
  item,
  showCore = false,
  showActionBar = false,
  onTranslate,
}: AIAnnotationResultUpgradeCardProps) {
  const [translating, setTranslating] = useState(false);
  // translateItemV2 clears aiResult to null at the start, so the button
  // animates even before the local `translating` state flips.
  const isTranslating = translating || item.aiResult === null;

  async function handleTranslate() {
    if (!onTranslate) return;
    setTranslating(true);
    try {
      await onTranslate();
    } finally {
      setTranslating(false);
    }
  }

  if (!showCore) return null;

  return (
    <div className="space-y-1">
      {/* Header: OLD label + page number + v1 badge */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-ctp-maroon uppercase tracking-wider">
            LEGACY
          </span>
          {item.kind === "manual" ? (
            <span className="inline-flex items-center rounded bg-ctp-green/15 px-1.5 py-0.5 text-ctp-green text-xs font-medium">
              manual
            </span>
          ) : (
            <span className="text-ctp-overlay0">p.{item.pageNumber}</span>
          )}
        </div>
        <span className="shrink-0 inline-flex items-center rounded bg-ctp-subtext/15 px-1.5 py-0.5 text-ctp-subtext text-xs">
          v{item.aiVersion}
        </span>
      </div>

      {/* Message */}
      <p className="mb-1 text-ctp-overlay0 text-xs leading-relaxed">
        Legacy version — re-translate to V2.
      </p>

      {/* Source text */}
      <p className="mb-1 whitespace-pre-wrap wrap-break-word leading-relaxed font-medium">
        {item.text}
      </p>

      {/* Action bar — single re-translate button */}
      {showActionBar && onTranslate && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          <button
            className="inline-flex items-center gap-1 rounded border border-ctp-mauve/40 bg-ctp-mauve/10 px-2 py-1 text-ctp-mauve text-xs font-medium transition-colors hover:bg-ctp-mauve/20 disabled:opacity-60"
            onClick={(e) => {
              e.stopPropagation();
              void handleTranslate();
            }}
            title="Re-translate this annotation with the V2 pipeline"
            disabled={isTranslating}
          >
            {isTranslating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Re-translate to V2
          </button>
        </div>
      )}
    </div>
  );
}
