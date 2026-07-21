import { FileText } from "lucide-react";
import type { FuseResultMatch } from "fuse.js";
import type { SearchEntry } from "@/stores/search.store";

// ── Highlight helper ──────────────────────────────────────────────────

/**
 * Given text and match indices, returns segments of { text, highlighted }
 * for rendering with `<mark>` tags in JSX.
 */
function highlightText(
  text: string,
  indices: readonly (readonly [number, number])[] | undefined,
): Array<{ text: string; highlighted: boolean }> {
  if (!indices || indices.length === 0) return [{ text, highlighted: false }];

  const segments: Array<{ text: string; highlighted: boolean }> = [];
  let lastEnd = 0;

  for (const [start, end] of indices) {
    if (start > lastEnd) {
      segments.push({ text: text.slice(lastEnd, start), highlighted: false });
    }
    segments.push({ text: text.slice(start, end + 1), highlighted: true });
    lastEnd = end + 1;
  }

  if (lastEnd < text.length) {
    segments.push({ text: text.slice(lastEnd), highlighted: false });
  }

  return segments;
}

// ── Component ─────────────────────────────────────────────────────────

interface SearchResultItemProps {
  entry: SearchEntry;
  matches?: ReadonlyArray<FuseResultMatch>;
  isSelected: boolean;
  onJumpTo: () => void;
  onViewCard: () => void;
}

export function SearchResultItem({
  entry,
  matches,
  isSelected,
  onJumpTo,
  onViewCard,
}: SearchResultItemProps) {
  const { annotation, documentTitle } = entry;

  // Find matches that apply to the searchText field
  const textMatches = matches?.find((m) => m.key === "searchText");
  const docMatches = matches?.find((m) => m.key === "documentTitle");

  const displayedText = annotation.text || "(no text)";
  const textSegments = highlightText(displayedText, textMatches?.indices);

  const kindLabel = annotation.kind === "manual" ? "manual" : annotation.kind === "annotation" ? null : "highlight";

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2 transition-colors
        ${isSelected ? "bg-ctp-surface0 border-l-ctp-mauve" : "border-l-transparent hover:bg-ctp-surface0/50"}
      `}
      onClick={onViewCard}
      onDoubleClick={onJumpTo}
    >
      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm leading-snug truncate">
          {textSegments.map((seg, i) =>
            seg.highlighted ? (
              <mark key={i} className="bg-ctp-yellow/30 text-ctp-text rounded-sm">
                {seg.text}
              </mark>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="inline-flex items-center gap-0.5 text-xs text-ctp-overlay0 truncate max-w-50">
            <FileText className="h-3 w-3 shrink-0" />
            {docMatches ? (
              highlightText(documentTitle, docMatches.indices).map((seg, i) =>
                seg.highlighted ? (
                  <mark key={i} className="bg-ctp-yellow/30 text-ctp-text rounded-sm text-xs">
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )
            ) : (
              <span className="truncate">{documentTitle}</span>
            )}
          </span>
          {annotation.pageNumber > 0 && (
            <span className="text-[10px] text-ctp-overlay0 bg-ctp-surface0/60 px-1 rounded">
              p{annotation.pageNumber}
            </span>
          )}
          {kindLabel && (
            <span className="text-[10px] text-ctp-overlay0 bg-ctp-surface0/60 px-1 rounded uppercase">
              {kindLabel}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          className="inline-flex items-center justify-center rounded border border-ctp-overlay0/50 bg-ctp-surface0/40 p-1 hover:bg-ctp-surface0 transition-colors"
          title="View card"
          onClick={(e) => {
            e.stopPropagation();
            onViewCard();
          }}
        >
          <svg className="h-3.5 w-3.5 text-ctp-overlay0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        <button
          className="inline-flex items-center justify-center rounded border border-ctp-overlay0/50 bg-ctp-surface0/40 p-1 hover:bg-ctp-surface0 transition-colors"
          title="Jump to annotation"
          onClick={(e) => {
            e.stopPropagation();
            onJumpTo();
          }}
        >
          <svg className="h-3.5 w-3.5 text-ctp-overlay0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
