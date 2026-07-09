import { useRef, useEffect, useState, useCallback } from "react"
import { BookOpen, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Maximize, Minimize, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PdfViewer } from "@/components/document/PdfViewer"
import { usePdfViewerStore } from "@/stores/pdf-viewer.store"
import { useAnnotationStore, type AnnotationEmbedData } from "@/stores/annotation.store"

// ---------------------------------------------------------------------------
// Fit-to-width toggle button.  Uses setViewerScale directly so it can pass
// "page-width" / "auto" to viewer.currentScaleValue without going through the
// numeric pdfScaleValue prop (which must stay a number for proximity-check).
// ---------------------------------------------------------------------------
function FitWidthButton() {
  const fitWidth = usePdfViewerStore((s) => s.fitWidth)
  const setFitWidth = usePdfViewerStore((s) => s.setFitWidth)
  const setViewerScale = usePdfViewerStore((s) => s.setViewerScale)
  const setPdfScale = usePdfViewerStore((s) => s.setPdfScale)

  const toggle = useCallback(() => {
    if (!setViewerScale) return
    if (fitWidth) {
      setViewerScale("auto")
      setFitWidth(false)
      setPdfScale(0) // back to auto mode
    } else {
      setViewerScale("page-width")
      setFitWidth(true)
    }
  }, [fitWidth, setViewerScale, setFitWidth, setPdfScale])

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-6 w-6 ${fitWidth ? "bg-accent" : ""}`}
      onClick={toggle}
      title={fitWidth ? "Auto zoom" : "Fit to width"}
    >
      {fitWidth ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Settings button — scale / zoom presets
// ---------------------------------------------------------------------------
const SCALE_PRESETS = [
  { label: "Auto", value: "auto" },
  { label: "Fit width", value: "page-width" },
  { label: "Fit page", value: "page-fit" },
  { label: "Actual size", value: "page-actual" },
] as const

function SettingsButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const setViewerScale = usePdfViewerStore((s) => s.setViewerScale)
  const setFitWidth = usePdfViewerStore((s) => s.setFitWidth)
  const setPdfScale = usePdfViewerStore((s) => s.setPdfScale)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => document.addEventListener("click", handler), 0)
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    return () => {
      clearTimeout(id)
      document.removeEventListener("click", handler)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setOpen(!open)}
        title="PDF settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border bg-popover p-1 shadow-md">
          {SCALE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent"
              onClick={() => {
                if (!setViewerScale) return
                setViewerScale(preset.value)
                if (preset.value === "page-width") {
                  setFitWidth(true)
                } else {
                  setFitWidth(false)
                  setPdfScale(0) // back to auto
                }
                setOpen(false)
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface CenterPanelProps {
  documentPath?: string | null
  documentId?: string | null
  leftCollapsed?: boolean
  rightCollapsed?: boolean
  onToggleLeft?: () => void
  onToggleRight?: () => void
}

export function CenterPanel({ documentPath, documentId, leftCollapsed, rightCollapsed, onToggleLeft, onToggleRight }: CenterPanelProps) {
  const setItems = useAnnotationStore((s) => s.setItems)
  const loadedDocRef = useRef<string | null>(null)

  // Load annotations from Electron backend when document changes
  useEffect(() => {
    if (!documentId) {
      setItems([])
      loadedDocRef.current = null
      return
    }

    loadedDocRef.current = documentId

    window.siltflow.annotations.list(documentId).then((saved) => {
      if (loadedDocRef.current !== documentId) return
      setItems(
        (saved || []).map((a: any) => ({
          id: a.id,
          documentId: a.documentId,
          type: a.type,
          text: a.text || "",
          pageNumber: a.pageNumber ?? 1,
          embedData: JSON.parse(a.embedData) as AnnotationEmbedData,
        })),
      )
    })
  }, [documentId, setItems])

  if (!documentPath) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-10 items-center border-b px-3">
          <Button variant="ghost" size="icon" className="h-6 w-6 -ml-1" onClick={onToggleLeft}>
            {leftCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <h1 className="flex-1 text-sm font-medium text-center">Siltflow</h1>
          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1" onClick={onToggleRight}>
            {rightCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <BookOpen className="h-12 w-12" />
            <p className="text-sm">Select a document to start reading</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center border-b px-3">
        <Button variant="ghost" size="icon" className="h-6 w-6 -ml-1 shrink-0" onClick={onToggleLeft}>
          {leftCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
        <h1 className="flex-1 text-sm font-medium truncate text-center px-2">
          {documentPath.split("/").pop()?.split("\\").pop()}
        </h1>
        <div className="flex items-center gap-1 shrink-0">
          <FitWidthButton />
          <SettingsButton />
          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1" onClick={onToggleRight}>
            {rightCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        <PdfViewer
          className="h-full w-full"
          src={documentPath!}
          documentId={documentId!}
        />
      </div>
    </div>
  )
}