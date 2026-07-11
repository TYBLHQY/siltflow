import { useEffect, useState } from "react"
import type { AnnotationItem } from "@/stores/annotation.store"
import { StudyPanel } from "@/components/document/StudyPanel"
import { Dialog, DialogContent } from "@/components/ui/dialog"

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
  const [open, setOpen] = useState(true)

  // Safety-net ESC close (StudyPanel also handles ESC via shortcut system)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  // When parent closes us (items becomes empty), start exit animation
  useEffect(() => {
    if (items.length === 0) setOpen(false)
  }, [items.length])

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent hideClose className="flex w-full max-w-2xl h-[calc(100vh-80px)] max-h-[700px] flex-col rounded-lg border bg-background shadow-xl p-0 gap-0">
        {items.length > 0 && (
          <StudyPanel
            items={items}
            studyingIndex={studyingIndex}
            answerRevealed={answerRevealed}
            setAnswerRevealed={setAnswerRevealed}
            onRate={onRate}
            onBack={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
