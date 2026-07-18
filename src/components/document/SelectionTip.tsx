import { useCallback } from "react";
import { Plus, Volume2 } from "lucide-react";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import { useAnnotationStore, type AnnotationItem } from "@/stores/annotation.store";
import { useDocumentStore } from "@/stores/document.store";
import { useTTS } from "@/hooks/useTts";
import { useSummaryStore } from "@/stores/summary.store";

/**
 * Floating "Add annotation" + "Read aloud" bar that appears after text selection
 * in manual mode. Rendered via the library's selectionTip prop.
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

  const handleAdd = useCallback(() => {
    if (!pendingAnnotation) return;
    const docId = useDocumentStore.getState().currentDocument?.id;
    if (!docId) return;
    const id = crypto.randomUUID();
    const item: AnnotationItem = {
      id,
      documentId: docId,
      type: "text",
      text: pendingAnnotation.text,
      pageNumber: pendingAnnotation.pageNumber,
      embedData: {
        position: pendingAnnotation.position,
        content: { text: pendingAnnotation.text },
      },
    };
    addItem(item);
    setPendingAnnotation(null);
    // Clear text selection so the blue highlight disappears
    window.getSelection()?.removeAllRanges();
  }, [pendingAnnotation, addItem, setPendingAnnotation]);

  const handlePlay = useCallback(() => {
    if (!pendingAnnotation) return;
    tts.speak(pendingAnnotation.text, undefined, sourceLang);
  }, [pendingAnnotation, tts, sourceLang]);

  if (!pendingAnnotation) return null;

  return (
    <div
      className="flex items-center shadow-lg"
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
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={handleAdd}
        title="Add annotation"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
