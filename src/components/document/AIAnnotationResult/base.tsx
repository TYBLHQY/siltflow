import { useState, type ReactNode } from "react";
import type { AnnotationItem } from "@/stores/annotation.store";
import { useStyleStore, buildFontStack } from "@/stores/style.store";
import { useTTS } from "@/hooks/useTts";
import { useShortcut } from "@/hooks/useShortcut";
import {
  Pencil,
  Volume2,
  Loader2,
  Sparkles,
  Trash2,
  ExternalLink,
} from "lucide-react";

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
  /** Source language for TTS voice selection. */
  sourceLang?: string;
  /** Slot rendered between the source text and the action bar. */
  contextSlot?: ReactNode;
  /** When set, replaces the source text with this editor. */
  textEditorSlot?: ReactNode;
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
  sourceLang,
  contextSlot,
  textEditorSlot,
}: AIAnnotationResultBaseProps) {
  const style = useStyleStore((s) => s.style);
  const tts = useTTS();

  // ── Translate spinner ──────────────────────────────────────────────
  const [translating, setTranslating] = useState(false);
  // Also show spinner when aiResult === null, which signals an in-flight
  // translation from batch translate (translateItemV2 clears aiResult before
  // the AI call so individual card buttons animate too).
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

  // ── listenCardAudio shortcut ──
  useShortcut(
    "listenCardAudio",
    () => {
      if (tts.speakingId === item.id && tts.state === "playing") tts.stop();
      else void tts.speak(item.text, undefined, sourceLang, item.id);
    },
    { enabled: !!item },
  );

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
          {/* Goto highlight — inline, no chrome, at the head of the row.
              Always rendered (invisible on manual cards with no callback)
              so the UNTRANSLATED label stays aligned across cards. */}
          <button
            className={`inline-flex items-center rounded p-0.5 align-baseline transition-colors cursor-pointer text-ctp-overlay1 hover:text-ctp-text ${
              onGoToHighlight ? "" : "invisible"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onGoToHighlight?.();
            }}
            title="Go to highlight in PDF"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
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

      {/* Source text — edit toggle is an inline element at the head of the
          text flow (no chrome unless editing). When editing, the card passes
          a textarea via textEditorSlot and only the text swaps. Only the text
          glyphs stop propagation (so clicking/dragging words does not toggle
          expand); the row's whitespace still toggles. */}
      {textEditorSlot ? (
        textEditorSlot
      ) : (
        <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">
          {onEditToggle && (
            <button
              className={`inline-flex items-center rounded p-0.5 mr-2 align-baseline transition-colors cursor-pointer ${
                editing
                  ? "text-ctp-mauve"
                  : "text-ctp-overlay1 hover:text-ctp-text"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onEditToggle();
              }}
              title={editing ? "Save" : "Edit"}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          <span onClick={(e) => e.stopPropagation()}>{item.text}</span>
        </p>
      )}

      {/* Context note editor — above the action bar */}
      {contextSlot}

      {/* ── Action bar ── */}
      {showActionBar && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          {/* TTS */}
          <button
            className={`inline-flex items-center justify-center rounded border border-ctp-overlay0/50 bg-ctp-surface0/40 p-1 transition-colors cursor-pointer ${
              tts.speakingId === item.id && tts.state === "playing"
                ? "text-ctp-mauve"
                : "text-ctp-maroon hover:bg-ctp-surface0"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (tts.speakingId === item.id && tts.state === "playing")
                tts.stop();
              else void tts.speak(item.text, undefined, sourceLang, item.id);
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
              className={`inline-flex items-center justify-center rounded border border-ctp-overlay0/50 bg-ctp-surface0/40 p-1 transition-colors cursor-pointer ${
                isTranslating
                  ? "text-ctp-maroon/60"
                  : "text-ctp-maroon hover:bg-ctp-surface0"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                void handleTranslate();
              }}
              title="Translate"
              disabled={isTranslating}
            >
              {isTranslating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {onDelete && (
            <button
              className="ml-auto inline-flex items-center justify-center rounded border border-ctp-overlay0/50 bg-ctp-surface0/40 p-1 text-ctp-maroon hover:bg-ctp-surface0 hover:text-ctp-red transition-colors cursor-pointer"
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
