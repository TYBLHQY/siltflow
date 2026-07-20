import { useState } from "react";
import type { AnnotationItem } from "@/stores/annotation.store";
import { useStyleStore, buildFontStack } from "@/stores/style.store";
import { useTTS } from "@/hooks/useTts";
import { Pencil, Volume2, Loader2, Sparkles, Trash2, ExternalLink } from "lucide-react";

interface AIAnnotationResultBaseProps {
  item: AnnotationItem;
  /** Show core: header + source text + action bar. */
  showCore?: boolean;
  /** Unused in base state — accepted for interface compatibility. */
  showDetails?: boolean;
  /** Show action bar below source text. */
  showActionBar?: boolean;
  // ── Action bar callbacks & state ──
  onEditToggle?: () => void;
  editing?: boolean;
  onTranslate?: () => void | Promise<void>;
  onDelete?: () => void;
  onGoToHighlight?: () => void;
}

/**
 * Blank-slate card for annotations that haven't been translated yet.
 *
 * Renders the header (labelled "HIGHLIGHT"), source text, and action bar
 * without any AI-specific content. Serves as the shared entry-point before
 * version-specific rendering (V1 / V2) picks up once AI data is available.
 */
export function AIAnnotationResultBase({
  item,
  showCore = false,
  showActionBar = false,
  editing,
  onEditToggle,
  onTranslate,
  onDelete,
  onGoToHighlight,
}: AIAnnotationResultBaseProps) {
  const style = useStyleStore((s) => s.style);
  const tts = useTTS();

  // ── Translate spinner ──────────────────────────────────────────────
  const [translating, setTranslating] = useState(false);

  async function handleTranslate() {
    if (!onTranslate) return;
    setTranslating(true);
    try {
      await onTranslate();
    } finally {
      setTranslating(false);
    }
  }

  // ── listenCardAudio shortcut ───────────────────────────────────────
  // The base component does not register a global TTS shortcut because
  // there's no source-language info yet. V1/V2 pick this up once AI data
  // is available.

  if (!showCore) return null;

  return (
    <div
      className="space-y-1 opacity-50"
      style={{
        fontFamily: buildFontStack(style.fontFamilies),
        fontSize: style.fontSize,
      }}
    >
      {/* Header: HIGHLIGHT label + page number — no version badge */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-ctp-overlay0 uppercase tracking-wider">
            UNTRANSLATED
          </span>
          {item.kind === "manual" ? (
            <span className="inline-flex items-center rounded bg-ctp-green/15 px-1.5 py-0.5 text-ctp-green text-xs font-medium">
              manual
            </span>
          ) : (
            <span className="text-ctp-overlay0">p.{item.pageNumber}</span>
          )}
        </div>
      </div>

      {/* Source text */}
      <p className="mb-1 whitespace-pre-wrap wrap-break-word leading-relaxed">
        {item.text}
      </p>

      {/* ── Action bar ── */}
      {showActionBar && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          {onGoToHighlight && (
            <button
              className="inline-flex items-center justify-center rounded border border-ctp-overlay0/50 bg-ctp-surface0/40 p-1 text-ctp-maroon hover:bg-ctp-surface0 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onGoToHighlight();
              }}
              title="Go to highlight in PDF"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}

          {onEditToggle && (
            <button
              className={`inline-flex items-center justify-center rounded border border-ctp-overlay0/50 bg-ctp-surface0/40 p-1 transition-colors ${
                editing
                  ? "text-ctp-mauve"
                  : "text-ctp-maroon hover:bg-ctp-surface0"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onEditToggle();
              }}
              title={editing ? "Save" : "Edit"}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}

          {/* TTS */}
          <button
            className={`inline-flex items-center justify-center rounded border border-ctp-overlay0/50 bg-ctp-surface0/40 p-1 transition-colors ${
              tts.speakingId === item.id && tts.state === "playing"
                ? "text-ctp-mauve"
                : "text-ctp-maroon hover:bg-ctp-surface0"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (tts.speakingId === item.id && tts.state === "playing")
                tts.stop();
              else tts.speak(item.text, undefined, undefined, item.id);
            }}
            title={
              tts.speakingId === item.id && tts.state === "playing"
                ? "Stop"
                : "Read aloud"
            }
          >
            {tts.speakingId === item.id && tts.state === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>

          {onTranslate && (
            <button
              className={`inline-flex items-center justify-center rounded border border-ctp-overlay0/50 bg-ctp-surface0/40 p-1 transition-colors ${
                translating
                  ? "text-ctp-maroon/60"
                  : "text-ctp-maroon hover:bg-ctp-surface0"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleTranslate();
              }}
              title="Translate"
              disabled={translating}
            >
              {translating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {onDelete && (
            <button
              className="ml-auto inline-flex items-center justify-center rounded border border-ctp-overlay0/50 bg-ctp-surface0/40 p-1 text-ctp-maroon hover:bg-ctp-surface0 hover:text-ctp-red transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
