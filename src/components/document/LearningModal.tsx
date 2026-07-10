import { useEffect } from "react"
import type { AnnotationItem } from "@/stores/annotation.store"
import { StudyPanel } from "@/components/document/StudyPanel"

interface LearningModalProps {
  items: AnnotationItem[]
  studyingIndex: number
  answerRevealed: boolean
  setAnswerRevealed: (v: boolean) => void
  onRate: (grade: number) => void
  onClose: () => void
}

/**
 * Full-screen modal overlay for the Start Learning (StudyPanel) flow.
 * Renders the study panel in a centered, window-height-tracking container
 * so it stays on top of the annotation list.
 */
export function LearningModal({
  items,
  studyingIndex,
  answerRevealed,
  setAnswerRevealed,
  onRate,
  onClose,
}: LearningModalProps) {
  // Safety-net ESC close (StudyPanel also handles ESC via shortcut system)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-2xl h-[calc(100vh-80px)] max-h-[700px] flex-col rounded-lg border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <StudyPanel
          items={items}
          studyingIndex={studyingIndex}
          answerRevealed={answerRevealed}
          setAnswerRevealed={setAnswerRevealed}
          onRate={onRate}
          onBack={onClose}
        />
      </div>
    </div>
  )
}
