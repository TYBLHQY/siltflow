import type { AnnotationItem } from "@/stores/annotation.store";
import { useStyleStore, buildFontStack } from "@/stores/style.store";
import { useTTS } from "@/hooks/useTts";
import { useShortcut } from "@/hooks/useShortcut";
import { useState } from "react";
import {
  Highlighter,
  Pencil,
  Volume2,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { IconText } from "@/components/ui/icon-text";
import { KnuthPlassText } from "@/components/ui/knuth-plass-text";
import { renderBoldText } from "@/components/ui/render-bold";
import {
  getTranslation,
  getDefinitions,
  getCollocations,
  getIpa,
  getDifficulty,
  getRegister,
  getAlternatives,
  inferGranularity,
} from "@/lib/annotation-helpers";
import type { DefinitionEntry } from "@/types/annotation";

interface AIAnnotationResultV1Props {
  item: AnnotationItem;
  /** Show core content: header (granularity + page), source text, translation + meta tags + definitions. */
  showCore?: boolean;
  /** Show detail sections: examples + collocations + alternatives. */
  showDetails?: boolean;

  /** Register the listenCardAudio keyboard shortcut (default: false). */
  enableShortcut?: boolean;

  // ── Action bar (callbacks & state) ──
  /** Show action bar between source text and AI content. */
  showActionBar?: boolean;
  onEditToggle?: () => void;
  editing?: boolean;
  /** Called when translate is clicked. Return a Promise so the spinner resolves when it completes. */
  onTranslate?: () => void | Promise<void>;
  onDelete?: () => void;
}

/**
 * Shared rendering of AI annotation analysis data.
 *
 * Used by both AITranslateCard (annotations tab) and StudyPanel
 * (learning modal) so that AI data format iteration only needs to
 * touch one component.
 *
 * - `showCore` controls the header / source text / translation / meta tags / definitions block
 * - `showDetails` controls the examples / collocations / alternatives block
 * - FSRS stats are rendered by the caller directly so the animation
 *   wrapper in AITranslateCard can be placed around details only
 */
export function AIAnnotationResultV1({
  item,
  showCore = false,
  showDetails = false,
  enableShortcut = false,
  showActionBar = false,
  editing,
  onEditToggle,
  onTranslate,
  onDelete,
}: AIAnnotationResultV1Props) {
  const style = useStyleStore((s) => s.style);
  const ai = item.aiResult;
  const tts = useTTS();

  // ── Translate spinner management ──
  const [translating, setTranslating] = useState(false);

  async function handleTranslate() {
    if (!onTranslate) return;
    setTranslating(true);
    try { await onTranslate(); } finally { setTranslating(false); }
  }

  // ── listenCardAudio shortcut ──
  useShortcut("listenCardAudio", () => {
    if (tts.speakingId === item.id && tts.state === "playing") tts.stop();
    else tts.speak(item.text, undefined, item.aiResult?.source_lang, item.id);
  }, { enabled: enableShortcut && !!item });

  // When showCore is true we always render header + source text + action bar,
  // even without AI data. Only skip if there's nothing to show at all.
  // Keep mounted during translate so the spinner doesn't disappear.
  if (!ai && !showCore && !translating) return null;

  const translation = ai ? getTranslation(ai) : undefined;
  const defs = ai ? getDefinitions(ai) : [];
  const colls = ai ? getCollocations(ai) : [];
  const ipa = ai ? getIpa(ai) : undefined;
  const difficulty = ai ? getDifficulty(ai) : undefined;
  const register = ai ? getRegister(ai) : undefined;
  const alts = ai ? getAlternatives(ai) : [];
  const examples = (ai?.examples) ?? [];
  const granularity = ai ? inferGranularity(ai, item.text) : "highlight";
  const isWord = granularity === "word" || granularity === "phrase";

  return (
    <div
      className="space-y-1"
      style={{
        fontFamily: buildFontStack(style.fontFamilies),
        fontSize: style.fontSize,
      }}
    >
      {/* ── Core: header + source text + translation + meta tags + definitions ── */}
      {showCore && (
        <>
          {/* Header: granularity + page + version */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <IconText icon={Highlighter} size="xs">
                <span className="font-medium text-muted-foreground uppercase tracking-wider">
                  {granularity}
                </span>
              </IconText>
              <span className="text-muted-foreground">p.{item.pageNumber}</span>
            </div>
            {item.aiVersion && (
              <span className="shrink-0 inline-flex items-center rounded bg-subtext/15 px-1.5 py-0.5 text-subtext text-xs">
                v{item.aiVersion}
              </span>
            )}
          </div>

          {/* Source text */}
          <KnuthPlassText text={item.text} className="mb-1" />

          {/* ── Action bar ── */}
          {showActionBar && (
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {/* Edit button — only show if caller provides onEditToggle */}
              {onEditToggle && (
                <button
                  className={`inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 transition-colors ${
                    editing ? "text-primary" : "text-maroon hover:bg-accent"
                  }`}
                  onClick={(e) => { e.stopPropagation(); onEditToggle(); }}
                  title={editing ? "Save" : "Edit"}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}

              {/* TTS button — always available when showActionBar */}
              <button
                className={`inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 transition-colors ${
                  tts.speakingId === item.id && tts.state === "playing" ? "text-primary" : "text-maroon hover:bg-accent"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (tts.speakingId === item.id && tts.state === "playing") tts.stop();
                  else tts.speak(item.text, undefined, item.aiResult?.source_lang, item.id);
                }}
                title={tts.speakingId === item.id && tts.state === "playing" ? "Stop" : "Read aloud"}
              >
                {tts.speakingId === item.id && tts.state === "loading" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </button>

              {onTranslate && (
                <button
                  className={`inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 transition-colors ${
                    translating ? "text-maroon/60" : "text-maroon hover:bg-accent"
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
                  className="ml-auto inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 text-maroon hover:bg-accent hover:text-destructive transition-colors"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {translation && (
            <p className="font-medium text-primary leading-relaxed">
              {renderBoldText(translation)}
            </p>
          )}

          {(difficulty || (ipa && isWord) || register) && (
            <div className="flex flex-wrap gap-1">
              {difficulty && (
                <span className="inline-flex items-center rounded bg-rosewater/15 px-1.5 py-0.5 text-rosewater">
                  {difficulty}
                </span>
              )}
              {ipa && isWord && (
                <span className="inline-flex items-center rounded bg-flamingo/15 px-1.5 py-0.5 text-flamingo">
                  {ipa.startsWith("/") ? ipa : `/${ipa}/`}
                </span>
              )}
              {register && (
                <span className="inline-flex items-center rounded bg-lavender/15 px-1.5 py-0.5 text-lavender">
                  {register}
                </span>
              )}
            </div>
          )}

          {defs.length > 0 && (
            <div className="space-y-0.5">
              <div className="font-bold text-peach mb-0.5 text-center">
                Definitions
              </div>
              {defs.slice(0, 5).map((d: DefinitionEntry, i) => (
                <div key={i} className="leading-relaxed">
                  {d.pos && (
                    <span className="inline-flex items-center rounded bg-peach/15 px-1.5 py-0.5 text-peach mr-1">
                      {d.pos}
                    </span>
                  )}
                  {d.definition && (
                    <span className="text-foreground">{d.definition}</span>
                  )}
                  {d.gloss && (
                    <span className="text-overlay0 ml-1">{d.gloss}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Details: examples + collocations + alternatives ── */}
      {showDetails && (
        <div className="space-y-1.5 text-muted-foreground pt-1.5 leading-relaxed">
          {examples.length > 0 && (
            <div>
              <span className="font-bold text-peach flex items-center justify-center mb-0.5 text-center">
                Examples
              </span>
              <ul className="space-y-1">
                {examples.slice(0, 5).map((ex, i) => (
                  <li key={i}>
                    <span className="text-foreground">
                      {renderBoldText(ex.sentence)}
                    </span>
                    {ex.translation && (
                      <span className="text-overlay0 block ml-0">
                        {renderBoldText(ex.translation)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {colls.length > 0 && (
            <div>
              <span className="font-bold text-peach flex items-center justify-center mb-0.5 text-center">
                Collocations
              </span>
              <div className="space-y-0.5">
                {colls.map((c, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="font-medium text-foreground">
                      {c.phrase}
                    </span>
                    <span className="text-overlay0"> {c.translation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alts.length > 0 && (
            <div>
              <span className="font-bold text-peach flex items-center justify-center mb-0.5 text-center">
                Alternatives
              </span>
              <div className="space-y-0.5">
                {alts.map((a, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="font-medium text-foreground">
                      {a.expression}
                    </span>
                    {a.register && (
                      <span className="inline-flex items-center rounded bg-lavender/15 px-1.5 py-0.5 text-lavender ml-1">
                        {a.register}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
