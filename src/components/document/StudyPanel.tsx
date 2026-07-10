import { useCallback } from "react"
import type { AnnotationItem } from "@/stores/annotation.store"
import { KnuthPlassText } from "@/components/ui/KnuthPlassText"
import { Volume2, ArrowLeft, CheckSquare } from "lucide-react"
import { useTTS } from "@/lib/use-tts"
import { useShortcut } from "@/hooks/useShortcut"

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
        <p className="text-sm font-medium text-foreground">All caught up!</p>
        <button
          className="text-xs text-primary hover:underline"
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

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header: card X of Y + back */}
      <div className="flex items-center justify-between border-b px-3 py-1.5 shrink-0">
        <button
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
        <span className="text-[10px] text-muted-foreground">
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
            className="text-base font-medium text-center"
          />

          {!answerRevealed && (
            <p className="text-[10px] text-muted-foreground">
              Tap to reveal answer
            </p>
          )}
        </div>

        {/* Answer (revealed) */}
        {answerRevealed && ai && (
          <div className="border-t px-4 py-3 space-y-2 overflow-y-auto">
            {/* Translation */}
            {ai.translations && ai.translations.length > 0 && (
              <p className="text-sm font-medium text-primary">
                {ai.translations[0]!.target}
                {ai.translations.length > 1 && (
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">
                    +{ai.translations.length - 1} more
                  </span>
                )}
              </p>
            )}

            {/* Definition */}
            {ai.definitions && ai.definitions[0] && (
              <p className="text-xs text-muted-foreground">
                {ai.definitions[0].part_of_speech && (
                  <span className="italic mr-1">{ai.definitions[0].part_of_speech}</span>
                )}
                {ai.definitions[0].definition_local ?? ai.definitions[0].definition}
              </p>
            )}

            {/* Phonetic */}
            {ai.phonetic && (
              <p className="text-xs text-muted-foreground/70 italic">
                {ai.phonetic}
              </p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {ai.difficulty_level && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {ai.difficulty_level}
                </span>
              )}
              {ai.category_tags?.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="border-t px-3 py-2 shrink-0 space-y-2">
        {/* TTS button */}
        <button
          className={`flex items-center gap-1 text-[10px] transition-colors ${
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
          <Volume2 className="h-3 w-3" />
          {tts.state === "playing" ? "Stop" : "Listen"}
        </button>

        {/* Rating buttons (only visible after reveal) */}
        {answerRevealed && (
          <div className="flex gap-1">
            {GRADE_LABELS.map((g) => (
              <button
                key={g.grade}
                className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${g.color}`}
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
