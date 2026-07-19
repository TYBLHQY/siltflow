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
import { useAnnotationStore } from "@/stores/annotation.store";
import { Volume2, BookmarkPlus, Highlighter } from "lucide-react";
import type { SiltflowHighlight } from "./PdfViewer";

interface SiltflowHighlightContainerProps {
  deleteHighlight(id: string): void;
  /** Called when user clicks a highlight in the PDF */
  onHighlightClick?(highlightId: string): void;
}

/**
 * Renders whichever highlight component matches `highlight.type`.
 * This is what gets passed as a child to `<PdfHighlighter>`.
 *
 * For plain highlights (`kind === "highlight"`), adds a "convert to annotation"
 * extra button. For annotation highlights (`kind === "annotation"`), adds a
 * "convert to plain highlight" button.
 */
export function SiltflowHighlightContainer({
  deleteHighlight,
  onHighlightClick,
}: SiltflowHighlightContainerProps) {
  const { highlight, isScrolledTo, highlightBindings } =
    useHighlightContainerContext<SiltflowHighlight>();

  const updateItem = useAnnotationStore((s) => s.updateItem);

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

  // Convert-to-annotation button (only for plain highlights)
  const convertToAnnotationButton = highlight.kind === "highlight" ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        updateItem(highlight.id, { kind: "annotation" });
      }}
      title="Convert to annotation"
      className="flex items-center justify-center w-6 h-6 hover:opacity-80 transition-opacity"
      style={{ color: "var(--selection-tip-fg)" }}
    >
      <BookmarkPlus className="h-3.5 w-3.5" />
    </button>
  ) : null;

  // Convert-to-highlight button (only for annotation highlights)
  const convertToHighlightButton = highlight.kind === "annotation" ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        updateItem(highlight.id, { kind: "highlight" });
      }}
      title="Convert to plain highlight"
      className="flex items-center justify-center w-6 h-6 hover:opacity-80 transition-opacity"
      style={{ color: "var(--selection-tip-fg)" }}
    >
      <Highlighter className="h-3.5 w-3.5" />
    </button>
  ) : null;

  // Build the extraButtons array for TextHighlight / AreaHighlight
  const kindButton = highlight.kind === "highlight"
    ? convertToAnnotationButton
    : convertToHighlightButton;

  const extraButtons = (
    <>
      {kindButton}
      {highlightTTSButton}
    </>
  );

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
          extraButtons={extraButtons}
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
