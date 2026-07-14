import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  PdfLoader,
  PdfHighlighter,
  TextHighlight,
  AreaHighlight,
  type IHighlight,
  type NewHighlight,
  type ScaledPosition,
} from "react-pdf-highlighter-plus";
import "react-pdf-highlighter-plus/style/style.css";
import "react-pdf-highlighter-plus/style/pdf_viewer.css";
import type { WebViewToRNMessage, SerializedAnnotation } from "./bridge";
import { toHighlight } from "./bridge";

/** Declare the postMessage bridge injected by React Native WebView */
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (data: string) => void;
    };
  }
}

// ============================================================================
// Bridge helpers
// ============================================================================

function sendToRN(msg: WebViewToRNMessage) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
}

// ============================================================================
// App
// ============================================================================

export default function App() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<IHighlight[]>([]);
  const [documentId, setDocumentId] = useState<string>("");
  const scrollRef = useRef<(page: number) => void>(null);

  // Listen for init messages from React Native
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "init") {
          setDocumentId(msg.documentId);

          // Create a blob URL from the base64 PDF
          const binaryStr = atob(msg.pdfBase64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);

          // Convert annotations to highlights
          if (msg.annotations?.length > 0) {
            setHighlights(
              msg.annotations.map((a: SerializedAnnotation) => toHighlight(a)),
            );
          }
        }
      } catch {
        // ignore malformed messages
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Notify RN that we're ready
  useEffect(() => {
    if (pdfUrl) {
      // Total pages will be sent by the PdfLoader callback
    }
  }, [pdfUrl]);

  const handleSelectionFinished = useCallback(
    (sourceRect: ScaledPosition, content: { text?: string }) => {
      if (!content.text) return;

      // Notify RN of the selection — RN will show the annotation UI
      sendToRN({
        type: "text-selection",
        text: content.text,
        pageNumber: sourceRect.pageNumber,
        position: {
          boundingRect: sourceRect.boundingRect,
          rects: sourceRect.rects,
          pageNumber: sourceRect.pageNumber,
        },
      });

      return null;
    },
    [],
  );

  if (!pdfUrl) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#999",
          fontFamily: "sans-serif",
          fontSize: 14,
        }}
      >
        Loading PDF viewer…
      </div>
    );
  }

  return (
    <PdfLoader
      url={pdfUrl}
      beforeLoad={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#ccc",
            fontFamily: "sans-serif",
          }}
        >
          Loading PDF…
        </div>
      }
    >
      {(pdfDocument) => {
        // Notify RN of total pages
        sendToRN({ type: "loaded", totalPages: pdfDocument.numPages });

        return (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            highlights={highlights}
            onSelectionFinished={handleSelectionFinished}
            highlightTransform={(
              highlight: IHighlight,
              index: number,
              setTip: (tip: JSX.Element) => void,
              hideTip: () => void,
              viewportToScaled: (rect: any) => ScaledPosition,
              screenshot: (rect: any) => string,
              isScrolledTo: boolean,
            ) => {
              const isTextHighlight = !(highlight.content && highlight.content.image);

              const component = isTextHighlight ? (
                <TextHighlight
                  key={highlight.id}
                  highlight={highlight}
                  isScrolledTo={isScrolledTo}
                  onMouseOver={(e) => {
                    setTip(
                      <div
                        onMouseEnter={() => setTip(<div />)}
                        onMouseLeave={hideTip}
                        style={{
                          background: "#333",
                          color: "#fff",
                          padding: "6px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                          maxWidth: 250,
                        }}
                        onClick={() => {
                          sendToRN({ type: "highlight-click", annotationId: highlight.id });
                        }}
                      >
                        {highlight.comment?.text || "View annotation"}
                      </div>,
                    );
                  }}
                />
              ) : (
                <AreaHighlight
                  key={highlight.id}
                  highlight={highlight}
                  isScrolledTo={isScrolledTo}
                  onChange={(rect) => {}}
                />
              );

              return component;
            }}
          />
        );
      }}
    </PdfLoader>
  );
}
