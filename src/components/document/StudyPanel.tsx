import { useCallback } from "react";
import type { AnnotationItem } from "@/stores/annotation.store";
import { IconText } from "@/components/ui/icon-text";
import { KnuthPlassText } from "@/components/ui/KnuthPlassText";
import {
  Volume2,
  ArrowLeft,
  CheckSquare,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useTTS } from "@/lib/use-tts";
import { useShortcut } from "@/hooks/useShortcut";
import { useStyleStore, buildFontStack } from "@/stores/style.store";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import { renderBoldText } from "@/lib/render-bold";
import { FSRSStats } from "@/components/document/FSRSStats";

interface StudyPanelProps {
  items: AnnotationItem[];
  studyingIndex: number;
  answerRevealed: boolean;
  setAnswerRevealed: (v: boolean) => void;
  onRate: (grade: number) => void;
  onBack: () => void;
}

const GRADE_LABELS: { grade: number; label: string; color: string }[] = [
  {
    grade: 1,
    label: "Again",
    color: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
  },
  {
    grade: 2,
    label: "Hard",
    color: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20",
  },
  {
    grade: 3,
    label: "Good",
    color: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
  },
  {
    grade: 4,
    label: "Easy",
    color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
  },
];

// ── Backward-compat helpers (same as AITranslateCard) ──

function getTranslation(
  ai: NonNullable<AnnotationItem["aiResult"]>,
): string | undefined {
  return ai.translation || ai.translate;
}

function getDefinitions(ai: NonNullable<AnnotationItem["aiResult"]>) {
  if (ai.definitions && ai.definitions.length > 0) {
    return ai.definitions.filter((d) => d.definition || d.gloss);
  }
  if (ai.words && ai.words.length > 0) {
    return ai.words
      .filter((w) => w.word)
      .map((w) => ({
        pos: w.pos,
        definition: w.word,
        gloss: w.meaning,
        _legacyWord: w.word,
      }));
  }
  return [];
}

function getCollocations(ai: NonNullable<AnnotationItem["aiResult"]>) {
  if (ai.collocations && ai.collocations.length > 0) return ai.collocations;
  if (ai.frequently && ai.frequently.length > 0) return ai.frequently;
  return [];
}

function getIpa(
  ai: NonNullable<AnnotationItem["aiResult"]>,
): string | undefined {
  return ai.pronunciation?.ipa || ai.phonetic;
}

function getDifficulty(
  ai: NonNullable<AnnotationItem["aiResult"]>,
): string | undefined {
  return ai.metadata?.difficulty || ai.difficulty_level;
}

function getTags(
  ai: NonNullable<AnnotationItem["aiResult"]>,
): string[] | undefined {
  return ai.metadata?.tags || ai.category_tags;
}

function getRegister(
  ai: NonNullable<AnnotationItem["aiResult"]>,
): string | undefined {
  return ai.metadata?.register;
}

function getAlternatives(ai: NonNullable<AnnotationItem["aiResult"]>) {
  if (ai.alternatives && ai.alternatives.length > 0) return ai.alternatives;
  if (ai.words) {
    const syns = ai.words.filter((w) => w.pos === "syn");
    if (syns.length > 0)
      return syns.map((s) => ({
        expression: s.word,
        register: undefined as string | undefined,
      }));
  }
  return [];
}

export function StudyPanel({
  items,
  studyingIndex,
  answerRevealed,
  setAnswerRevealed,
  onRate,
  onBack,
}: StudyPanelProps) {
  const item = items[studyingIndex];
  const tts = useTTS();
  const style = useStyleStore((s) => s.style);
  const scrollToHighlight = usePdfViewerStore((s) => s.scrollToHighlight);

  const handleReveal = useCallback(() => {
    if (!answerRevealed) setAnswerRevealed(true);
  }, [answerRevealed, setAnswerRevealed]);

  const handleGradeAgain = useCallback(() => onRate(1), [onRate]);
  const handleGradeHard = useCallback(() => onRate(2), [onRate]);
  const handleGradeGood = useCallback(() => onRate(3), [onRate]);
  const handleGradeEasy = useCallback(() => onRate(4), [onRate]);

  const handleListen = useCallback(() => {
    if (!item) return;
    if (tts.state === "playing") tts.stop();
    else tts.speak(item.text, undefined, item.aiResult?.source_lang);
  }, [item, tts]);

  const handleGoToHighlight = useCallback(() => {
    if (!item) return;
    onBack();
    // Small delay so the modal closes before scrolling
    requestAnimationFrame(() => scrollToHighlight?.(item.id));
  }, [item, onBack, scrollToHighlight]);

  // Learning mode shortcuts (only active when item exists)
  useShortcut("revealCard", handleReveal, {
    enabled: !!item && !answerRevealed,
  });
  useShortcut("gradeAgain", handleGradeAgain, {
    enabled: !!item && answerRevealed,
  });
  useShortcut("gradeHard", handleGradeHard, {
    enabled: !!item && answerRevealed,
  });
  useShortcut("gradeGood", handleGradeGood, {
    enabled: !!item && answerRevealed,
  });
  useShortcut("gradeEasy", handleGradeEasy, {
    enabled: !!item && answerRevealed,
  });
  useShortcut("backFromLearning", onBack, { enabled: !!item });
  useShortcut("listenCardAudio", handleListen, { enabled: !!item });

  if (!item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground px-4">
        <CheckSquare className="h-10 w-10" />
        <p className="font-medium text-foreground">All caught up!</p>
        <button className="text-primary hover:underline" onClick={onBack}>
          Back to annotations
        </button>
      </div>
    );
  }

  const ai = item.aiResult;
  const total = items.length;
  const current = studyingIndex + 1;

  // Resolve data with backward compat
  const translation = ai ? getTranslation(ai) : undefined;
  const defs = ai ? getDefinitions(ai) : [];
  const colls = ai ? getCollocations(ai) : [];
  const ipa = ai ? getIpa(ai) : undefined;
  const difficulty = ai ? getDifficulty(ai) : undefined;
  const tags = ai ? getTags(ai) : undefined;
  const register = ai ? getRegister(ai) : undefined;
  const examples = ai?.examples ?? [];
  const alts = ai ? getAlternatives(ai) : [];

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header: card X of Y + back */}
      <div className="flex items-center justify-between border-b px-3 py-1.5 shrink-0">
        <button
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <IconText icon={ArrowLeft} size="xs">
            Back
          </IconText>
        </button>
        <span className="text-muted-foreground">
          {current} / {total}
        </span>
        <button
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          onClick={handleGoToHighlight}
          title="Go to highlight in PDF"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card area — click/tap to reveal */}
      <div
        className="flex-1 min-h-0 flex flex-col cursor-pointer"
        onClick={handleReveal}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-3">
          {/* Before reveal: show only the source text */}
          <KnuthPlassText
            text={item.text}
            className="font-medium text-center"
          />

          {!answerRevealed && (
            <p className="text-muted-foreground">Tap to reveal answer</p>
          )}
        </div>

        {/* Answer (revealed) */}
        {answerRevealed && ai && (
          <div
            className="border-t px-4 py-3 space-y-2 overflow-y-auto"
            style={{
              fontFamily: buildFontStack(style.fontFamilies),
              fontSize: style.fontSize,
            }}
          >
            {/* Translation */}
            {translation && (
              <p className="font-medium text-primary leading-relaxed">
                {renderBoldText(translation)}
              </p>
            )}

            {/* Lemma + POS + register + IPA */}
            {(ai.lemma || ai.pos || register || ipa) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {ai.lemma && (
                  <span className="font-semibold text-foreground">
                    {ai.lemma}
                  </span>
                )}
                {ai.pos && (
                  <span className="inline-flex items-center rounded bg-peach/15 px-1.5 py-0.5 text-peach">
                    {ai.pos}
                  </span>
                )}
                {register && (
                  <span className="inline-flex items-center rounded bg-lavender/15 px-1.5 py-0.5 text-lavender">
                    {register}
                  </span>
                )}
                {ipa && (
                  <span className="inline-flex items-center rounded bg-flamingo/15 px-1.5 py-0.5 text-flamingo">
                    {ipa.startsWith("/") ? ipa : `/${ipa}/`}
                  </span>
                )}
              </div>
            )}

            {/* Tags */}
            {(difficulty || (tags && tags.length > 0)) && (
              <div className="flex flex-wrap gap-1">
                {difficulty && (
                  <span className="inline-flex items-center rounded bg-rosewater/15 px-1.5 py-0.5 text-rosewater">
                    {difficulty}
                  </span>
                )}
                {tags?.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded bg-teal/15 px-1.5 py-0.5 text-teal"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Definitions */}
            {defs.length > 0 && (
              <div className="space-y-0.5">
                {defs.slice(0, 5).map((d: any, i) => (
                  <div key={i} className="leading-relaxed">
                    {d._legacyWord ? (
                      <>
                        <span className="font-medium">{d._legacyWord}</span>
                        {d.pos && (
                          <span className="text-muted-foreground/60 ml-1">
                            {d.pos}
                          </span>
                        )}
                        <span className="text-overlay0 ml-1">
                          {d.gloss || d.meaning}
                        </span>
                      </>
                    ) : (
                      <>
                        {d.pos && (
                          <span className="inline-flex items-center rounded bg-peach/15 px-1.5 py-0.5 text-peach mr-1">
                            {d.pos}
                          </span>
                        )}
                        <span className="text-foreground">{d.definition}</span>
                        {d.gloss && (
                          <span className="text-overlay0 ml-1">
                            {d.gloss}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Examples */}
            {examples.length > 0 && (
              <div>
                <span className="font-bold text-peach flex items-center justify-center mb-0.5 text-center">
                  Examples
                </span>
                <ul className="space-y-1 leading-relaxed">
                  {examples.slice(0, 5).map((ex: any, i) => (
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

            {/* Collocations */}
            {colls.length > 0 && (
              <div>
                <span className="font-bold text-peach flex items-center justify-center mb-0.5 text-center">
                  Collocations
                </span>
                <div className="space-y-0.5 leading-relaxed">
                  {colls.map((c: any, i) => (
                    <div key={i}>
                      <span className="font-medium text-foreground">
                        {c.phrase}
                      </span>
                      <span className="text-overlay0">
                        {" "}
                        {c.translation}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternatives */}
            {alts.length > 0 && (
              <div>
                <span className="font-bold text-peach flex items-center justify-center mb-0.5 text-center">
                  Alternatives
                </span>
                <div className="space-y-0.5 leading-relaxed">
                  {alts.map((a: any, i) => (
                    <div key={i}>
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

            {/* ── FSRS card stats ── */}
            {item.fsrsCard && <FSRSStats card={item.fsrsCard} />}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="border-t px-3 py-2 shrink-0 space-y-2">
        {/* TTS button */}
        <button
          className={`flex items-center gap-1 transition-colors ${
            tts.state === "playing"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (tts.state === "playing") tts.stop();
            else tts.speak(item.text, undefined, item.aiResult?.source_lang);
          }}
        >
          {tts.state === "loading" ? (
            <IconText icon={Loader2} size="xs">
              Stop
            </IconText>
          ) : (
            <IconText icon={Volume2} size="xs">
              {tts.state === "playing" ? "Stop" : "Listen"}
            </IconText>
          )}
        </button>

        {/* Rating buttons (only visible after reveal) */}
        {answerRevealed && (
          <div className="flex gap-1">
            {GRADE_LABELS.map((g) => (
              <button
                key={g.grade}
                className={`flex-1 rounded px-2 py-1 font-medium transition-colors ${g.color}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRate(g.grade);
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
