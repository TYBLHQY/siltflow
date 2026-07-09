import { forwardRef, useCallback } from "react"
import { PDFViewer } from "@embedpdf/react-pdf-viewer"
import type { PDFViewerRef } from "@embedpdf/react-pdf-viewer"

interface PdfViewerProps {
  src: string
  onReady?: (registry: PDFViewerRef["registry"]) => void
  className?: string
}

export const PdfViewer = forwardRef<PDFViewerRef, PdfViewerProps>(
  function PdfViewer({ src, onReady, className }, ref) {
    const handleReady = useCallback(
      (registry: PDFViewerRef["registry"]) => {
        onReady?.(registry)
      },
      [onReady]
    )

    return (
      <div className={className}>
        <PDFViewer
          ref={ref}
          config={{
            src,
          }}
          style={{ width: "100%", height: "100%" }}
          onReady={handleReady}
        />
      </div>
    )
  }
)
