import { useCallback } from "react";
import type { AnnotationItem } from "@/stores/annotation.store";
import { IconText } from "@/components/ui/icon-text";
import { KnuthPlassText } from "@/components/ui/knuth-plass-text";
import {
  ArrowLeft,
  CheckSquare,
  ExternalLink,
} from "lucide-react";
import { useShortcut } from "@/hooks/useShortcut";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import { AIAnnotationResult } from "@/components/document/AIAnnotationResult";
import { FSRSStats } from "@/components/document/FSRSStats";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    color: "bg-red/10 text-ctp-redhover:bg-red/20",
  },
  {
    grade: 2,
    label: "Hard",
    color: "bg-ctp-maroon/10 text-ctp-maroon hover:bg-ctp-maroon/20",
  },
  {
    grade: 3,
    label: "Good",
    color: "bg-green/10 text-ctp-green hover:bg-green/20",
  },
  {
    grade: 4,
    label: "Easy",
    color: "bg-sky/10 text-ctp-sky hover:bg-sky/20",
  },
];

export function StudyPanel({
  items,
  studyingIndex,
  answerRevealed,
  setAnswerRevealed,
  onRate,
  onBack,
}: StudyPanelProps) {
  const item = items[studyingIndex];
  const scrollToHighlight = usePdfViewerStore((s) => s.scrollToHighlight);

  const handleReveal = useCallback(() => {
    if (!answerRevealed) setAnswerRevealed(true);
  }, [answerRevealed, setAnswerRevealed]);

  const handleGradeAgain = useCallback(() => onRate(1), [onRate]);
  const handleGradeHard = useCallback(() => onRate(2), [onRate]);
  const handleGradeGood = useCallback(() => onRate(3), [onRate]);
  const handleGradeEasy = useCallback(() => onRate(4), [onRate]);

  const handleGoToHighlight = useCallback(() => {
    if (!item) return;
    onBack();
    requestAnimationFrame(() => {
      scrollToHighlight?.(item.id);
      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent("siltflow:annotation-click", { detail: { id: item.id } }),
        );
      });
    });
  }, [item, onBack, scrollToHighlight]);

  // Learning mode shortcuts
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
  // listenCardAudio is handled inside AIAnnotationResult

  if (!item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-ctp-overlay0 px-4">
        <CheckSquare className="h-10 w-10" />
        <p className="font-medium text-ctp-text">All caught up!</p>
        <button className="text-ctp-mauve hover:underline" onClick={onBack}>
          Back to annotations
        </button>
      </div>
    );
  }

  const ai = item.aiResult;
  const total = items.length;
  const current = studyingIndex + 1;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header: card X of Y + back */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
        <button
          className="flex items-center gap-1 text-ctp-overlay0 hover:text-ctp-text"
          onClick={onBack}
        >
          <IconText icon={ArrowLeft} size="xs">
            Back
          </IconText>
        </button>
        <span className="text-ctp-overlay0">
          {current} / {total}
        </span>
        <button
          className="flex items-center gap-1 text-ctp-overlay0 hover:text-ctp-text"
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
        {answerRevealed && ai ? (
          /* ── Answer revealed: full card ── */
          <div className="px-3 pb-3 min-h-0 flex-1">
            <ScrollArea className="h-full rounded-lg border border-ctp-overlay0/80 bg-white dark:bg-ctp-mantle shadow-sm">
              <div className="px-3 py-2.5 space-y-2">
                <AIAnnotationResult
                  item={item}
                  showCore
                  showDetails
                  showActionBar
                  enableShortcut
                />

                {/* FSRS card stats */}
                {item.fsrsCard && (
                  <FSRSStats
                    card={item.fsrsCard}
                    annotationId={item.id}
                    documentId={item.documentId}
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          /* ── Before reveal: question centered ── */
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-3">
            <KnuthPlassText
              text={item.text}
              className="font-medium text-center"
            />
            <p className="text-ctp-overlay0">Tap to reveal answer</p>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="px-3 pb-2 shrink-0 space-y-2">
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
