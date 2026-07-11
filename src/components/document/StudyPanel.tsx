import { useCallback } from "react"
import type { AnnotationItem } from "@/stores/annotation.store"
import { IconText } from "@/components/ui/icon-text"
import { KnuthPlassText } from "@/components/ui/KnuthPlassText"
import { Volume2, ArrowLeft, CheckSquare, Loader2 } from "lucide-react"
import { useTTS } from "@/lib/use-tts"
import { useShortcut } from "@/hooks/useShortcut"
import { useStyleStore, buildFontStack } from "@/stores/style.store"
import { renderBoldText } from "@/lib/render-bold"

interface StudyPanelProps {
  items: AnnotationItem[]
  studyingIndex: number
  answerRevealed: boolean
  setAnswerRevealed: (v: boolean) => void
  onRate: (grade: number) => void
  onBack: () => void
}

const GRADE_LABELS: { grade: number; label: string; color: string }[] = [
  { grade: 1, label: "Again", color: "bg-red-500/10 text-red-600 hover:bg-red-500/20" },
  { grade: 2, label: "Hard", color: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20" },
  { grade: 3, label: "Good", color: "bg-green-500/10 text-green-600 hover:bg-green-500/20" },
  { grade: 4, label: "Easy", color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20" },
]

// ── Backward-compat helpers (same as AITranslateCard) ──

function getTranslation(ai: NonNullable<AnnotationItem["aiResult"]>): string | undefined {
  return ai.translation || ai.translate
}

function getDefinitions(ai: NonNullable<AnnotationItem["aiResult"]>) {
  if (ai.definitions && ai.definitions.length > 0) {
    return ai.definitions.filter(d => d.definition || d.gloss)
  }
  if (ai.words && ai.words.length > 0) {
    return ai.words.filter(w => w.word).map(w => ({
      pos: w.pos,
      definition: w.word,
      gloss: w.meaning,
      _legacyWord: w.word,
    }))
  }
  return []
}

function getCollocations(ai: NonNullable<AnnotationItem["aiResult"]>) {
  if (ai.collocations && ai.collocations.length > 0) return ai.collocations
  if (ai.frequently && ai.frequently.length > 0) return ai.frequently
  return []
}

function getIpa(ai: NonNullable<AnnotationItem["aiResult"]>): string | undefined {
  return ai.pronunciation?.ipa || ai.phonetic
}

function getDifficulty(ai: NonNullable<AnnotationItem["aiResult"]>): string | undefined {
  return ai.metadata?.difficulty || ai.difficulty_level
}

function getTags(ai: NonNullable<AnnotationItem["aiResult"]>): string[] | undefined {
  return ai.metadata?.tags || ai.category_tags
}

function getRegister(ai: NonNullable<AnnotationItem["aiResult"]>): string | undefined {
  return ai.metadata?.register
}

function getAlternatives(ai: NonNullable<AnnotationItem["aiResult"]>) {
  if (ai.alternatives && ai.alternatives.length > 0) return ai.alternatives
  if (ai.words) {
    const syns = ai.words.filter(w => w.pos === "syn")
    if (syns.length > 0) return syns.map(s => ({ expression: s.word, register: undefined as string | undefined }))
  }
  return []
}

export function StudyPanel({
  items,
  studyingIndex,
  answerRevealed,
  setAnswerRevealed,
  onRate,
  onBack,
}: StudyPanelProps) {
  const item = items[studyingIndex]
  const tts = useTTS()
  const style = useStyleStore((s) => s.style)

  const handleReveal = useCallback(() => {
    if (!answerRevealed) setAnswerRevealed(true)
  }, [answerRevealed, setAnswerRevealed])

  const handleGradeAgain = useCallback(() => onRate(1), [onRate])
  const handleGradeHard = useCallback(() => onRate(2), [onRate])
  const handleGradeGood = useCallback(() => onRate(3), [onRate])
  const handleGradeEasy = useCallback(() => onRate(4), [onRate])

  // Learning mode shortcuts (only active when item exists)
  useShortcut("revealCard", handleReveal, { enabled: !!item && !answerRevealed })
  useShortcut("gradeAgain", handleGradeAgain, { enabled: !!item && answerRevealed })
  useShortcut("gradeHard", handleGradeHard, { enabled: !!item && answerRevealed })
  useShortcut("gradeGood", handleGradeGood, { enabled: !!item && answerRevealed })
  useShortcut("gradeEasy", handleGradeEasy, { enabled: !!item && answerRevealed })
  useShortcut("backFromLearning", onBack, { enabled: !!item })

  if (!item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground px-4">
        <CheckSquare className="h-10 w-10" />
        <p className="font-medium text-foreground">All caught up!</p>
        <button
          className="text-primary hover:underline"
          onClick={onBack}
        >
          Back to annotations
        </button>
      </div>
    )
  }

  const ai = item.aiResult
  const total = items.length
  const current = studyingIndex + 1

  // Resolve data with backward compat
  const translation = ai ? getTranslation(ai) : undefined
  const defs = ai ? getDefinitions(ai) : []
  const colls = ai ? getCollocations(ai) : []
  const ipa = ai ? getIpa(ai) : undefined
  const difficulty = ai ? getDifficulty(ai) : undefined
  const tags = ai ? getTags(ai) : undefined
  const register = ai ? getRegister(ai) : undefined
  const examples = ai?.examples ?? []
  const alts = ai ? getAlternatives(ai) : []
  const contextSentence = ai?.context_sentence

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header: card X of Y + back */}
      <div className="flex items-center justify-between border-b px-3 py-1.5 shrink-0">
        <button
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <IconText icon={ArrowLeft} size="xs">Back</IconText>
        </button>
        <span className="text-muted-foreground">
          {current} / {total}
        </span>
        <div className="w-8" />
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
            <p className="text-muted-foreground">
              Tap to reveal answer
            </p>
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

            {/* Lemma + POS + register */}
            {(ai.lemma || ai.pos || register) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {ai.lemma && <span className="font-semibold text-foreground">{ai.lemma}</span>}
                {ai.pos && (
                  <span className="rounded bg-peach/15 px-1.5 py-0.5 text-peach font-mono">{ai.pos}</span>
                )}
                {register && (
                  <span className="rounded bg-peach/15 px-1.5 py-0.5 text-peach">{register}</span>
                )}
              </div>
            )}

            {/* IPA */}
            {ipa && (
              <p className="text-muted-foreground/70 italic leading-relaxed">
                {ipa.startsWith("/") ? ipa : `/${ipa}/`}
              </p>
            )}

            {/* Tags */}
            {(difficulty || (tags && tags.length > 0)) && (
              <div className="flex flex-wrap gap-1">
                {difficulty && (
                  <span className="rounded bg-peach/15 px-1.5 py-0.5 text-peach">
                    {difficulty}
                  </span>
                )}
                {tags?.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded bg-peach/15 px-1.5 py-0.5 text-peach">
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
                        {d.pos && <span className="text-muted-foreground/60 ml-1">{d.pos}</span>}
                        <span className="text-muted-foreground ml-1">{d.gloss || d.meaning}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-foreground">{d.definition}</span>
                        {d.gloss && <span className="text-muted-foreground/70 ml-1">{d.gloss}</span>}
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
                      <span className="text-foreground">{renderBoldText(ex.sentence)}</span>
                      {ex.translation && (
                        <span className="text-muted-foreground block ml-0">
                          {renderBoldText(ex.translation)}
                          {ex.source === "context" && (
                            <span className="text-muted-foreground/50 ml-1">(from text)</span>
                          )}
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
                      <span className="font-medium text-foreground">{c.phrase}</span>
                      <span className="text-muted-foreground"> {c.translation}</span>
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
                      <span className="font-medium text-foreground">{a.expression}</span>
                      {a.register && (
                        <span className="text-muted-foreground/60 ml-1">({a.register})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Context sentence */}
            {contextSentence && (
              <p className="text-muted-foreground/80 italic leading-relaxed truncate">
                "{renderBoldText(contextSentence)}"
              </p>
            )}
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
            e.stopPropagation()
            if (tts.state === "playing") tts.stop()
            else tts.speak(item.text)
          }}
        >
          {tts.state === "loading" ? (
            <IconText icon={Loader2} size="xs">Stop</IconText>
          ) : (
            <IconText icon={Volume2} size="xs">{tts.state === "playing" ? "Stop" : "Listen"}</IconText>
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
                  e.stopPropagation()
                  onRate(g.grade)
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
