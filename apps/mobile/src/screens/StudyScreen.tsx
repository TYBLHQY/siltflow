import { useCallback, useMemo } from "react";
import { useAnnotationStore, type AnnotationItem } from "../stores/annotation.store";
import { useDocumentStore } from "../stores/document.store";
import { useTTS } from "../lib/use-tts";
import { BookOpen, Volume2, Square } from "lucide-react";
import type { AIAnnotationData } from "@siltflow/shared/types";

/**
 * Study screen — shows annotations as flashcard-style study cards.
 * Supports TTS and review actions.
 */
export default function StudyScreen() {
  const annotations = useAnnotationStore((s) => s.items);
  const documents = useDocumentStore((s) => s.documents);
  const tts = useTTS();

  const dueAnnotations = useMemo(() => {
    // For now, show all annotations that have no FSRS card or are due
    return annotations.filter((a) => {
      if (!a.fsrsCard) return true;
      const due = new Date(a.fsrsCard.due);
      return due <= new Date();
    });
  }, [annotations]);

  if (annotations.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold text-foreground mb-4">Study</h1>
        <div className="text-center py-12">
          <BookOpen className="size-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No annotations to study</p>
          <p className="text-xs text-muted-foreground mt-1">
            Highlight text in a PDF and sync to mobile to start studying
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-2">
      <h1 className="text-lg font-semibold text-foreground mb-3">
        Study
        <span className="text-sm font-normal text-muted-foreground ml-2">
          {dueAnnotations.length} cards due
        </span>
      </h1>

      <div className="space-y-3">
        {dueAnnotations.map((annotation) => (
          <StudyCard
            key={annotation.id}
            annotation={annotation}
            docTitle={
              documents.find((d) => d.id === annotation.documentId)?.title ?? "Unknown"
            }
            tts={tts}
          />
        ))}
      </div>
    </div>
  );
}

function StudyCard({
  annotation,
  docTitle,
  tts,
}: {
  annotation: AnnotationItem;
  docTitle: string;
  tts: ReturnType<typeof useTTS>;
}) {
  const aiData = annotation.aiResult as AIAnnotationData | undefined;

  const handleTTS = useCallback(() => {
    if (tts.status === "playing") {
      tts.stop();
    } else {
      tts.speak(annotation.text, aiData?.source_lang);
    }
  }, [tts, annotation.text, aiData?.source_lang]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="size-3.5" />
          <span className="truncate max-w-[180px]">{docTitle}</span>
        </div>

        {/* TTS button */}
        <button
          onClick={handleTTS}
          disabled={tts.status === "loading"}
          className={`p-1.5 rounded-md transition-colors ${
            tts.status === "playing"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
          title="Read aloud"
        >
          {tts.status === "loading" ? (
            <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : tts.status === "playing" ? (
            <Square className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </button>
      </div>

      {/* Original text */}
      <p className="text-sm text-foreground leading-relaxed">
        {annotation.text}
      </p>

      {/* AI translation */}
      {aiData?.translation && (
        <div className="text-sm text-muted-foreground border-t border-border pt-2">
          <p>{aiData.translation}</p>
        </div>
      )}
    </div>
  );
}
