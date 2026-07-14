import { useEffect } from "react";
import { useAnnotationStore } from "../stores/annotation.store";
import { useDocumentStore } from "../stores/document.store";
import { reviewAnnotation, getNextReview } from "../stores/fsrs.store";
import type { Grade } from "ts-fsrs";
import { RotateCcw } from "lucide-react";

export default function ReviewScreen() {
  const annotations = useAnnotationStore((s) => s.items);
  const documents = useDocumentStore((s) => s.documents);

  // Find cards due for review
  const dueCards = annotations.filter((a) => {
    if (!a.fsrsCard) return false;
    const due = new Date(a.fsrsCard.due);
    return due <= new Date();
  });

  const handleGrade = (annotationId: string, grade: Grade) => {
    reviewAnnotation(annotationId, grade);
  };

  if (dueCards.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold text-foreground mb-4">Review</h1>
        <div className="text-center py-12">
          <RotateCcw className="size-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No cards due for review</p>
          <p className="text-xs text-muted-foreground mt-1">Come back later!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-2">
      <h1 className="text-lg font-semibold text-foreground mb-3">
        Review
        <span className="text-sm font-normal text-muted-foreground ml-2">
          {dueCards.length} cards due
        </span>
      </h1>

      <div className="space-y-3">
        {dueCards.map((annotation) => {
          const docTitle =
            documents.find((d) => d.id === annotation.documentId)?.title ??
            "Unknown";

          return (
            <div
              key={annotation.id}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="text-xs text-muted-foreground">{docTitle}</div>

              <p className="text-sm text-foreground leading-relaxed">
                {annotation.text}
              </p>

              <div className="flex gap-2 pt-1">
                <GradeButton label="Again" grade={1} color="bg-red-500/80" onClick={() => handleGrade(annotation.id, 1)} />
                <GradeButton label="Hard" grade={2} color="bg-orange-500/80" onClick={() => handleGrade(annotation.id, 2)} />
                <GradeButton label="Good" grade={3} color="bg-green-500/80" onClick={() => handleGrade(annotation.id, 3)} />
                <GradeButton label="Easy" grade={4} color="bg-blue-500/80" onClick={() => handleGrade(annotation.id, 4)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GradeButton({
  label,
  onClick,
}: {
  label: string;
  grade: Grade;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-2 rounded-md text-xs font-medium text-white bg-secondary hover:bg-accent transition-colors"
    >
      {label}
    </button>
  );
}
