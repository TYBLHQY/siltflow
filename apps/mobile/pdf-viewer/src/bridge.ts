/**
 * Message types for React Native ↔ WebView PDF viewer communication.
 */

// ---------------------------------------------------------------------------
// RN → WebView
// ---------------------------------------------------------------------------

export interface InitMessage {
  type: "init";
  /** PDF file as base64-encoded string */
  pdfBase64: string;
  /** Document ID for the current PDF */
  documentId: string;
  /** Annotations to render as highlights */
  annotations: SerializedAnnotation[];
}

export type RNToWebViewMessage = InitMessage;

// ---------------------------------------------------------------------------
// WebView → RN
// ---------------------------------------------------------------------------

export interface HighlightClickMessage {
  type: "highlight-click";
  annotationId: string;
}

export interface TextSelectionMessage {
  type: "text-selection";
  /** The selected text content */
  text: string;
  /** 1-indexed page number */
  pageNumber: number;
  /** Serialized position info */
  position: {
    boundingRect: { x1: number; y1: number; x2: number; y2: number; width: number; height: number; pageNumber: number };
    rects: Array<{ x1: number; y1: number; x2: number; y2: number; width: number; height: number; pageNumber: number }>;
  };
  /** The surrounding sentence context, if available */
  contextSentence?: string;
}

export interface ScrollMessage {
  type: "scroll";
  pageNumber: number;
}

export interface LoadedMessage {
  type: "loaded";
  totalPages: number;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type WebViewToRNMessage =
  | HighlightClickMessage
  | TextSelectionMessage
  | ScrollMessage
  | LoadedMessage
  | ErrorMessage;

// ---------------------------------------------------------------------------
// Annotation ↔ Highlight conversion
// ---------------------------------------------------------------------------

/** Serializable annotation format passed from RN */
export interface SerializedAnnotation {
  id: string;
  text: string;
  pageNumber: number;
  /** Serialized ScaledPosition from react-pdf-highlighter-plus */
  position: {
    boundingRect: any;
    rects: any[];
    pageNumber: number;
  };
}

/**
 * Convert from RN's annotation format to react-pdf-highlighter-plus Highlight type.
 */
export function toHighlight(
  ann: SerializedAnnotation,
): import("react-pdf-highlighter-plus").Highlight {
  return {
    id: ann.id,
    content: { text: ann.text },
    position: {
      boundingRect: ann.position.boundingRect,
      rects: ann.position.rects,
      pageNumber: ann.position.pageNumber,
    },
    comment: { text: ann.text },
  };
}
