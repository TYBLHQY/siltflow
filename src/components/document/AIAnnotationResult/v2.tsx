import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AnnotationItem } from "@/stores/annotation.store";
import { useStyleStore, buildFontStack } from "@/stores/style.store";
import { useTTS } from "@/hooks/useTts";
import { useShortcut } from "@/hooks/useShortcut";
import { useSummaryStore } from "@/stores/summary.store";
import { Pencil, Volume2, Loader2, Sparkles, Trash2 } from "lucide-react";
import type {
  AIAnnotationDataV2,
  WordOutputV2,
  PhraseOutputV2,
  SentenceOutputV2,
} from "@/types/annotation";

interface AIAnnotationResultV2Props {
  item: AnnotationItem;
  showCore?: boolean;
  showDetails?: boolean;
  enableShortcut?: boolean;
  showActionBar?: boolean;
  onEditToggle?: () => void;
  editing?: boolean;
  onTranslate?: () => void | Promise<void>;
  onDelete?: () => void;
}

// ── Render helpers ─────────────────────────────────────────────────────────

function isWordOutput(
  output: AIAnnotationDataV2["output"],
): output is WordOutputV2 {
  return "meanings" in output;
}

function isSentenceOutput(
  output: AIAnnotationDataV2["output"],
): output is SentenceOutputV2 {
  // Sentence has ONLY "translation" — no examples, no meanings
  return "translation" in output && !("examples" in output);
}

function isPhraseOutput(
  output: AIAnnotationDataV2["output"],
): output is PhraseOutputV2 {
  // Phrase has "translation" + "examples"
  return "translation" in output && "examples" in output;
}

// ── SelectionTTSButton ──────────────────────────────────────────────────────
// Floating play button that appears above text selection within its container.
// Used for both source-language and target-language text blocks.

interface SelectionButtonState {
  text: string;
  lang: string | undefined;
  top: number;
  left: number;
}

function SelectionTTSButton({
  language,
  annId,
  children,
}: {
  language?: string;
  annId?: string | null;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tts = useTTS();
  const [btn, setBtn] = useState<SelectionButtonState | null>(null);

  // ── Detect text selection inside container ──

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setBtn(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!containerRef.current?.contains(range.commonAncestorContainer)) {
      setBtn(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      setBtn(null);
      return;
    }
    setBtn({
      text: sel.toString(),
      lang: language,
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  }, [language]);

  // ── Hide on outside click / scroll / Escape ──

  useEffect(() => {
    if (!btn) return;

    const hide = () => setBtn(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("mousedown", hide);
    document.addEventListener("wheel", hide, { passive: true });
    document.addEventListener("scroll", hide, { passive: true });
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", hide);
      document.removeEventListener("wheel", hide);
      document.removeEventListener("scroll", hide);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [btn]);

  // ── Play selected text via TTS ──

  const handlePlay = useCallback(() => {
    if (!btn) return;
    tts.speak(btn.text, undefined, btn.lang, annId);
    setBtn(null);
  }, [btn, tts, annId]);

  return (
    <div ref={containerRef} onMouseUp={handleMouseUp}>
      {children}

      {/* Floating play button above selection */}
      {btn && (
        <button
          className="fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-opacity hover:opacity-80"
          style={{
            top: btn.top,
            left: btn.left,
            width: 28,
            height: 28,
            transform: "translate(-50%, -100%)",
            backgroundColor: "var(--selection-tip-bg)",
            color: "var(--selection-tip-fg)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handlePlay}
          title="Read aloud"
        >
          <Volume2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Section header with left divider ──

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center mb-0.5">
      <div className="flex-1 h-px bg-ctp-overlay0/30" />
      <span className="text-ctp-text text-xs font-medium ml-3 whitespace-nowrap">
        {children}
      </span>
    </div>
  );
}

// ── Sub-renderers ──────────────────────────────────────────────────────────

function WordView({
  output,
  sourceLang,
  targetLang,
  annId,
}: {
  output: WordOutputV2;
  sourceLang?: string;
  targetLang?: string;
  annId?: string | null;
}) {
  return (
    <div className="space-y-2 leading-relaxed">
      {/* CEFR */}
      {output.cefr && (
        <div>
          <SectionHeader>CEFR</SectionHeader>
          <span className="inline-flex items-center rounded bg-ctp-rosewater/15 px-1.5 py-0.5 text-ctp-rosewater text-xs font-medium">
            {output.cefr}
          </span>
        </div>
      )}

      {/* Meanings — ordered by frequency */}
      {output.meanings.length > 0 && (
        <div>
          <SectionHeader>Meanings</SectionHeader>
          <div className="space-y-0.5">
            {output.meanings.map((m, i) => (
              <div key={i} className="flex items-baseline gap-1">
                <span className="inline-flex items-center rounded bg-ctp-sky/15 px-1.5 py-0.5 text-ctp-sky text-xs font-medium">
                  {m.pos}
                </span>
                <SelectionTTSButton language={targetLang} annId={annId}>
                  <span className="text-ctp-text">{m.translation}</span>
                </SelectionTTSButton>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Definitions */}
      {output.definitions.length > 0 && (
        <div>
          <SectionHeader>Definitions</SectionHeader>
          <div className="space-y-1">
            {output.definitions.map((d, i) => (
              <div key={i} className="leading-relaxed">
                <span className="inline-flex items-center rounded bg-ctp-sky/15 px-1.5 py-0.5 text-ctp-sky text-xs font-medium mr-1">
                  {d.pos}
                </span>
                <SelectionTTSButton language={sourceLang} annId={annId}>
                  <span className="text-ctp-text">{d.definition.source}</span>
                </SelectionTTSButton>
                <SelectionTTSButton language={targetLang} annId={annId}>
                  <span className="text-ctp-overlay0 block ml-0">
                    {d.definition.target}
                  </span>
                </SelectionTTSButton>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Examples */}
      {output.examples.length > 0 && (
        <div>
          <SectionHeader>Examples</SectionHeader>
          <ul className="space-y-1">
            {output.examples.map((ex, i) => (
              <li key={i}>
                <SelectionTTSButton language={sourceLang} annId={annId}>
                  <span className="text-ctp-text">{ex.sentence}</span>
                </SelectionTTSButton>
                {ex.translation && (
                  <SelectionTTSButton language={targetLang} annId={annId}>
                    <span className="text-ctp-overlay0 block ml-0">
                      {ex.translation}
                    </span>
                  </SelectionTTSButton>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Collocations */}
      {output.collocations.length > 0 && (
        <div>
          <SectionHeader>Collocations</SectionHeader>
          <div className="space-y-0.5">
            {output.collocations.map((c, i) => (
              <div key={i} className="leading-relaxed">
                <SelectionTTSButton language={sourceLang} annId={annId}>
                  <span className="text-ctp-text">{c.phrase}</span>
                </SelectionTTSButton>
                <SelectionTTSButton language={targetLang} annId={annId}>
                  <span className="text-ctp-overlay0"> {c.translation}</span>
                </SelectionTTSButton>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Synonyms */}
      {output.synonyms.length > 0 && (
        <div>
          <SectionHeader>Synonyms</SectionHeader>
          <div className="space-y-0.5">
            {output.synonyms.map((s, i) => (
              <SelectionTTSButton key={i} language={sourceLang} annId={annId}>
                <div className="text-ctp-text leading-relaxed">{s}</div>
              </SelectionTTSButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhraseView({
  output,
  sourceLang,
  targetLang,
  annId,
}: {
  output: PhraseOutputV2;
  sourceLang?: string;
  targetLang?: string;
  annId?: string | null;
}) {
  return (
    <div className="space-y-2 leading-relaxed">
      {output.translation && (
        <SelectionTTSButton language={targetLang} annId={annId}>
          <p className="font-medium text-ctp-mauve">{output.translation}</p>
        </SelectionTTSButton>
      )}

      {output.examples.length > 0 && (
        <div>
          <SectionHeader>Examples</SectionHeader>
          <ul className="space-y-1">
            {output.examples.map((ex, i) => (
              <li key={i}>
                <SelectionTTSButton language={sourceLang} annId={annId}>
                  <span className="text-ctp-text">{ex.sentence}</span>
                </SelectionTTSButton>
                {ex.translation && (
                  <SelectionTTSButton language={targetLang} annId={annId}>
                    <span className="text-ctp-overlay0 block ml-0">
                      {ex.translation}
                    </span>
                  </SelectionTTSButton>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SentenceView({
  output,
  targetLang,
  annId,
}: {
  output: SentenceOutputV2;
  targetLang?: string;
  annId?: string | null;
}) {
  if (!output.translation) return null;
  return (
    <SelectionTTSButton language={targetLang} annId={annId}>
      <p className="font-medium text-ctp-mauve leading-relaxed">
        {output.translation}
      </p>
    </SelectionTTSButton>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function AIAnnotationResultV2({
  item,
  showCore = false,
  enableShortcut = false,
  showActionBar = false,
  editing,
  onEditToggle,
  onTranslate,
  onDelete,
}: AIAnnotationResultV2Props) {
  const style = useStyleStore((s) => s.style);
  const ai = item.aiResult as AIAnnotationDataV2 | undefined;
  const tts = useTTS();
  const targetLang = useSummaryStore(
    (s) => s.targetLangs[item.documentId],
  ) ?? "zh-CN";

  // ── Translate spinner ──
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

  // ── listenCardAudio shortcut ──
  useShortcut(
    "listenCardAudio",
    () => {
      if (tts.speakingId === item.id && tts.state === "playing") tts.stop();
      else tts.speak(item.text, undefined, ai?.input?.source_lang, item.id);
    },
    { enabled: enableShortcut && !!item },
  );

  if (!ai && !showCore && !translating) return null;

  const granularity = ai?.input?.type ?? "word";
  const output = ai?.output;

  return (
    <div
      className="space-y-1"
      style={{
        fontFamily: buildFontStack(style.fontFamilies),
        fontSize: style.fontSize,
      }}
    >
      {/* ── Core: header + source text + action bar + output ── */}
      {showCore && (
        <>
          {/* Header: granularity + page + version */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-ctp-overlay0 uppercase tracking-wider">
                {granularity}
              </span>
              <span className="text-ctp-overlay0">p.{item.pageNumber}</span>
            </div>
            <span className="shrink-0 inline-flex items-center rounded bg-ctp-subtext/15 px-1.5 py-0.5 text-ctp-subtext text-xs">
              v2
            </span>
          </div>

          {/* Source text — with TTS selection */}
          <SelectionTTSButton language={ai?.input?.source_lang} annId={item.id}>
            <p className="mb-1 whitespace-pre-wrap wrap-break-word leading-relaxed">
              {ai?.input?.normalized ?? item.text}
            </p>
          </SelectionTTSButton>

          {/* ── Action bar ── */}
          {showActionBar && (
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
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
                  else
                    tts.speak(
                      item.text,
                      undefined,
                      ai?.input?.source_lang,
                      item.id,
                    );
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

          {/* ── Output section — mixed source/target lang TTS selection ── */}
          {output && isWordOutput(output) && (
            <WordView
              output={output}
              sourceLang={ai?.input?.source_lang}
              targetLang={targetLang}
              annId={item.id}
            />
          )}
          {output && isPhraseOutput(output) && (
            <PhraseView
              output={output}
              sourceLang={ai?.input?.source_lang}
              targetLang={targetLang}
              annId={item.id}
            />
          )}
          {output && isSentenceOutput(output) && (
            <SentenceView
              output={output}
              targetLang={targetLang}
              annId={item.id}
            />
          )}
        </>
      )}
    </div>
  );
}
