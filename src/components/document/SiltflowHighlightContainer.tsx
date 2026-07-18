import { useCallback } from "react";
import {
  TextHighlight,
  AreaHighlight,
  FreetextHighlight,
  DrawingHighlight,
  ImageHighlight,
  ShapeHighlight,
  useHighlightContainerContext,
} from "react-pdf-highlighter-plus";
import { useTTS } from "@/hooks/useTts";
import { Volume2 } from "lucide-react";
import type { SiltflowHighlight } from "./PdfViewer";

interface SiltflowHighlightContainerProps {
  deleteHighlight(id: string): void;
  /** Called when user clicks a highlight in the PDF */
  onHighlightClick?(highlightId: string): void;
}

/**
 * Renders whichever highlight component matches `highlight.type`.
 * This is what gets passed as a child to `<PdfHighlighter>`.
 */
export function SiltflowHighlightContainer({
  deleteHighlight,
  onHighlightClick,
}: SiltflowHighlightContainerProps) {
  const { highlight, isScrolledTo, highlightBindings } =
    useHighlightContainerContext<SiltflowHighlight>();

  const handleDelete = useCallback(
    () => deleteHighlight(highlight.id),
    [deleteHighlight, highlight.id],
  );

  const handleClick = useCallback(() => {
    onHighlightClick?.(highlight.id);
  }, [onHighlightClick, highlight.id]);

  // TTS button for the highlight toolbar — source language comes from
  // the annotation's AI result (same as card TTS), not from the doc summary.
  const tts = useTTS();

  const highlightTTSButton = highlight.content?.text ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        tts.speak(highlight.content!.text!, undefined, highlight.sourceLang, undefined);
      }}
      title="Read aloud"
      className="flex items-center justify-center w-6 h-6 hover:opacity-80 transition-opacity"
      style={{ color: "var(--selection-tip-fg)" }}
    >
      <Volume2 className="h-3.5 w-3.5" />
    </button>
  ) : null;

  switch (highlight.type) {
    case "text":
      return (
        <TextHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          highlightColor={highlight.highlightColor}
          onDelete={handleDelete}
          copyText={highlight.content?.text}
          onClick={handleClick}
          extraButtons={highlightTTSButton}
        />
      );

    case "freetext":
      return (
        <FreetextHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          bounds={highlightBindings.textLayer}
          onDelete={handleDelete}
        />
      );

    case "image":
      return (
        <ImageHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          bounds={highlightBindings.textLayer}
          onDelete={handleDelete}
        />
      );

    case "drawing":
      return (
        <DrawingHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          bounds={highlightBindings.textLayer}
          onDelete={handleDelete}
        />
      );

    case "shape":
      return (
        <ShapeHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          bounds={highlightBindings.textLayer}
          onDelete={handleDelete}
        />
      );

    default:
      // Area highlight — default fallback
      return (
        <AreaHighlight
          key={highlight.id}
          isScrolledTo={isScrolledTo}
          highlight={highlight}
          highlightColor={highlight.highlightColor}
          onChange={() => {
            /* update position on resize — optional */
          }}
          bounds={highlightBindings.textLayer}
          onDelete={handleDelete}
        />
      );
  }
}
