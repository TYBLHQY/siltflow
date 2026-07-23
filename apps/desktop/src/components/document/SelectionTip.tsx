import { useCallback } from "react";
import { PenLine, Volume2, Highlighter } from "lucide-react";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import { useAnnotationStore, type AnnotationItem } from "@/stores/annotation.store";
import { useDocumentStore } from "@/stores/document.store";
import { useStyleStore } from "@/stores/style.store";
import { useTTS } from "@/hooks/useTts";
import { useSummaryStore } from "@/stores/summary.store";
import { resolveHighlightCSSVar } from "@/lib/colors";

/**
 * Floating bar that appears after text selection in manual mode.
 * Two colored add buttons: one for annotation, one for plain highlight.
 * Each button shows the user-configured Catppuccin color.
 */
export function SelectionTip() {
  const setPendingAnnotation = usePdfViewerStore((s) => s.setPendingAnnotation);
  const pendingAnnotation = usePdfViewerStore((s) => s.pendingAnnotation);
  const addItem = useAnnotationStore((s) => s.addItem);
  const tts = useTTS();
  const documentId = useDocumentStore((s) => s.currentDocument?.id);
  const sourceLang = useSummaryStore(
    (s) => (documentId ? s.summaries[documentId]?.sourceLang : undefined),
  );
  const annotationColor = useStyleStore((s) => s.style.annotationHighlightColor);
  const plainColor = useStyleStore((s) => s.style.plainHighlightColor);

  const buildItem = useCallback(
    (kind: "annotation" | "highlight"): AnnotationItem | null => {
      if (!pendingAnnotation) return null;
      const docId = useDocumentStore.getState().currentDocument?.id;
      if (!docId) return null;
      return {
        id: crypto.randomUUID(),
        documentId: docId,
        type: "text",
        kind,
        text: pendingAnnotation.text,
        pageNumber: pendingAnnotation.pageNumber,
        embedData: {
          position: pendingAnnotation.position,
          content: { text: pendingAnnotation.text },
        },
      };
    },
    [pendingAnnotation],
  );

  const handleAddAsAnnotation = useCallback(() => {
    const item = buildItem("annotation");
    if (!item) return;
    addItem(item);
    setPendingAnnotation(null);
    window.getSelection()?.removeAllRanges();
  }, [buildItem, addItem, setPendingAnnotation]);

  const handleAddAsHighlight = useCallback(() => {
    const item = buildItem("highlight");
    if (!item) return;
    addItem(item);
    setPendingAnnotation(null);
    window.getSelection()?.removeAllRanges();
  }, [buildItem, addItem, setPendingAnnotation]);

  const handlePlay = useCallback(() => {
    if (!pendingAnnotation) return;
    tts.speak(pendingAnnotation.text, undefined, sourceLang);
  }, [pendingAnnotation, tts, sourceLang]);

  if (!pendingAnnotation) return null;

  const annoCSSVar = resolveHighlightCSSVar(annotationColor) || "var(--catppuccin-color-yellow)";
  const plainCSSVar = resolveHighlightCSSVar(plainColor) || "var(--catppuccin-color-green)";

  return (
    <div
      className="flex items-center shadow-lg gap-0.5"
      style={{
        padding: "3px",
        borderRadius: 10,
        backgroundColor: "var(--selection-tip-bg)",
        color: "var(--selection-tip-fg)",
      }}
    >
      <button
        className="flex items-center justify-center transition-colors"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          color: "var(--selection-tip-fg)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={handlePlay}
        title="Read aloud"
      >
        <Volume2 className="h-3.5 w-3.5" />
      </button>
      <button
        className="flex items-center justify-center transition-colors"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          color: "var(--selection-tip-fg)",
          backgroundColor: `color-mix(in srgb, ${annoCSSVar} 40%, transparent)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `color-mix(in srgb, ${annoCSSVar} 60%, transparent)`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `color-mix(in srgb, ${annoCSSVar} 40%, transparent)`;
        }}
        onClick={handleAddAsAnnotation}
        title="Add as annotation"
      >
        <PenLine className="h-3.5 w-3.5" />
      </button>
      <button
        className="flex items-center justify-center transition-colors"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          color: "var(--selection-tip-fg)",
          backgroundColor: `color-mix(in srgb, ${plainCSSVar} 40%, transparent)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `color-mix(in srgb, ${plainCSSVar} 60%, transparent)`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `color-mix(in srgb, ${plainCSSVar} 40%, transparent)`;
        }}
        onClick={handleAddAsHighlight}
        title="Add as plain highlight"
      >
        <Highlighter className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
