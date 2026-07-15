import { useCallback } from "react";
import type { AnnotationItem } from "@/stores/annotation.store";
import { IconText } from "@/components/ui/icon-text";
import { KnuthPlassText } from "@/components/ui/knuth-plass-text";
import {
  Volume2,
  ArrowLeft,
  CheckSquare,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useTTS } from "@/hooks/useTts";
import { useShortcut } from "@/hooks/useShortcut";
import { useStyleStore, buildFontStack } from "@/stores/style.store";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import { AIAnnotationResult } from "@/components/document/AIAnnotationResult";
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
  const aiVersion = item.aiVersion ?? undefined;
  const total = items.length;
  const current = studyingIndex + 1;

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
            <AIAnnotationResult
              item={item}
              version={aiVersion}
              showCore
              showDetails
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
