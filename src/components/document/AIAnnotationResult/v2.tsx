import { useState, type ReactNode } from "react";
import type { AnnotationItem } from "@/stores/annotation.store";
import { useStyleStore, buildFontStack } from "@/stores/style.store";
import { useTTS } from "@/hooks/useTts";
import { useShortcut } from "@/hooks/useShortcut";
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

function WordView({ output }: { output: WordOutputV2 }) {
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
                <span className="text-ctp-text">{m.translation}</span>
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
                <span className="text-ctp-text">{d.definition.source}</span>
                <span className="text-ctp-overlay0 block ml-0">
                  {d.definition.target}
                </span>
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
                <span className="text-ctp-text">{ex.sentence}</span>
                {ex.translation && (
                  <span className="text-ctp-overlay0 block ml-0">
                    {ex.translation}
                  </span>
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
                <span className="text-ctp-text">{c.phrase}</span>
                <span className="text-ctp-overlay0"> {c.translation}</span>
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
              <div key={i} className="text-ctp-text leading-relaxed">
                {s}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhraseView({ output }: { output: PhraseOutputV2 }) {
  return (
    <div className="space-y-2 leading-relaxed">
      {output.translation && (
        <p className="font-medium text-ctp-mauve">{output.translation}</p>
      )}

      {output.examples.length > 0 && (
        <div>
          <SectionHeader>Examples</SectionHeader>
          <ul className="space-y-1">
            {output.examples.map((ex, i) => (
              <li key={i}>
                <span className="text-ctp-text">{ex.sentence}</span>
                {ex.translation && (
                  <span className="text-ctp-overlay0 block ml-0">
                    {ex.translation}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SentenceView({ output }: { output: SentenceOutputV2 }) {
  if (!output.translation) return null;
  return (
    <p className="font-medium text-ctp-mauve leading-relaxed">
      {output.translation}
    </p>
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

          {/* Source text */}
          <p className="mb-1 whitespace-pre-wrap wrap-break-word leading-relaxed">
            {ai?.input?.normalized ?? item.text}
          </p>

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

          {/* ── Output section ── */}
          {output && isWordOutput(output) && <WordView output={output} />}
          {output && isPhraseOutput(output) && <PhraseView output={output} />}
          {output && isSentenceOutput(output) && (
            <SentenceView output={output} />
          )}
        </>
      )}
    </div>
  );
}
