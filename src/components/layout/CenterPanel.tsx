import { useRef, useEffect, useState, useCallback } from "react"
import { BookOpen, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Maximize, Minimize, Settings, Bot, X, BrainCircuit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PdfViewer } from "@/components/document/PdfViewer"
import { usePdfViewerStore } from "@/stores/pdf-viewer.store"
import { useAnnotationStore, type AnnotationEmbedData } from "@/stores/annotation.store"
import { useAIStore, BUILTIN_PROVIDERS } from "@/stores/ai.store"
import { useFSRSStore } from "@/stores/fsrs.store"

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
// Settings button — opens AI Config modal
// ---------------------------------------------------------------------------
function SettingsButton() {
  const [open, setOpen] = useState(false)
  const [aiConfigOpen, setAiConfigOpen] = useState(false)
  const [fsrsConfigOpen, setFsrsConfigOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open && !aiConfigOpen && !fsrsConfigOpen) return
    const id = setTimeout(() => document.addEventListener("click", handler), 0)
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    return () => {
      clearTimeout(id)
      document.removeEventListener("click", handler)
    }
  }, [open, aiConfigOpen, fsrsConfigOpen])

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setOpen(!open)}
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border bg-popover p-1 shadow-md">
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent"
            onClick={() => {
              setAiConfigOpen(true)
              setOpen(false)
            }}
          >
            <Bot className="h-3.5 w-3.5" />
            AI Config
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent"
            onClick={() => {
              setFsrsConfigOpen(true)
              setOpen(false)
            }}
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            Spaced Repetition
          </button>
        </div>
      )}
      {aiConfigOpen && <AIConfigModal onClose={() => setAiConfigOpen(false)} />}
      {fsrsConfigOpen && <FSRSConfigModal onClose={() => setFsrsConfigOpen(false)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI Config modal
// ---------------------------------------------------------------------------
function AIConfigModal({ onClose }: { onClose: () => void }) {
  const profiles = useAIStore((s) => s.profiles)
  const addProfile = useAIStore((s) => s.addProfile)
  const removeProfile = useAIStore((s) => s.removeProfile)
  const updateProfile = useAIStore((s) => s.updateProfile)
  const setActiveProfile = useAIStore((s) => s.setActiveProfile)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  // All built-in providers not yet configured
  const usedKeys = new Set(profiles.map((p) => p.providerKey))
  const availableProviders = BUILTIN_PROVIDERS.filter(
    (p: { key: string; editable?: boolean }) => !usedKeys.has(p.key) || p.editable,
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <h2 className="text-base font-semibold">AI Providers</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Profile list */}
        <div className="space-y-2">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`rounded-md border p-3 transition-colors ${
                profile.active ? "border-primary" : ""
              }`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {renameId === profile.id ? (
                    <input
                      className="w-40 rounded border bg-background px-2 py-0.5 text-sm"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        if (renameValue.trim()) {
                          updateProfile(profile.id, { name: renameValue.trim() })
                        }
                        setRenameId(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (renameValue.trim()) {
                            updateProfile(profile.id, { name: renameValue.trim() })
                          }
                          setRenameId(null)
                        }
                        if (e.key === "Escape") setRenameId(null)
                      }}
                    />
                  ) : (
                    <span className="text-sm font-medium truncate">{profile.name}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {profile.providerKey}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!profile.active && (
                    <button
                      className="text-[11px] text-primary hover:underline"
                      onClick={() => setActiveProfile(profile.id)}
                    >
                      Activate
                    </button>
                  )}
                  <button
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setRenameId(profile.id)
                      setRenameValue(profile.name)
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="text-[11px] text-destructive hover:underline"
                    onClick={() => removeProfile(profile.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Config fields */}
              {editingId === profile.id ? (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-0.5">Base URL</label>
                      <input
                        className="w-full rounded border bg-background px-2 py-1 text-xs"
                        value={profile.baseUrl}
                        onChange={(e) => updateProfile(profile.id, { baseUrl: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-0.5">Model</label>
                      <input
                        className="w-full rounded border bg-background px-2 py-1 text-xs"
                        value={profile.model}
                        onChange={(e) => updateProfile(profile.id, { model: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="block text-[10px] text-muted-foreground mb-0.5">API Key</label>
                    <input
                      type="password"
                      className="w-full rounded border bg-background px-2 py-1 text-xs"
                      value={profile.apiKey}
                      onChange={(e) => updateProfile(profile.id, { apiKey: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-0.5">Temperature</label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        className="w-full"
                        value={profile.temperature}
                        onChange={(e) =>
                          updateProfile(profile.id, { temperature: parseFloat(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-0.5">Max Tokens</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded border bg-background px-2 py-1 text-xs"
                        value={profile.maxTokens}
                        onChange={(e) =>
                          updateProfile(profile.id, { maxTokens: parseInt(e.target.value, 10) || 512 })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-0.5">Top P</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        className="w-full"
                        value={profile.topP}
                        onChange={(e) =>
                          updateProfile(profile.id, { topP: parseFloat(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{profile.baseUrl}</span>
                  <span>·</span>
                  <span>{profile.model}</span>
                </div>
              )}

              {/* Toggle config edit */}
              <button
                className="mt-1 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setEditingId(editingId === profile.id ? null : profile.id)}
              >
                {editingId === profile.id ? "Collapse" : "Edit params"}
              </button>
            </div>
          ))}
        </div>

        {/* Add provider */}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-primary hover:underline">
            + Add provider
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {availableProviders.map((provider: { key: string; label: string }) => (
              <button
                key={provider.key}
                className="rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                onClick={() => {
                  addProfile(provider.key)
                }}
              >
                {provider.label}
              </button>
            ))}
          </div>
        </details>

        <div className="mt-4 flex justify-end border-t pt-3">
          <Button size="sm" className="text-xs" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FSRS Config modal
// ---------------------------------------------------------------------------
function FSRSConfigModal({ onClose }: { onClose: () => void }) {
  const params = useFSRSStore((s) => s.params)
  const updateParam = useFSRSStore((s) => s.updateParam)
  const resetParams = useFSRSStore((s) => s.resetParams)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5" />
            <h2 className="text-base font-semibold">Spaced Repetition (FSRS)</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Request retention */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Retention rate ({Math.round(params.request_retention * 100)}%)
            </label>
            <input
              type="range"
              min="0.7"
              max="0.97"
              step="0.01"
              className="w-full"
              value={params.request_retention}
              onChange={(e) => updateParam("request_retention", parseFloat(e.target.value))}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Higher = more reviews, better retention. Default: 85%
            </p>
          </div>

          {/* Maximum interval */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Maximum interval (days: {params.maximum_interval})
            </label>
            <input
              type="range"
              min="30"
              max="3650"
              step="30"
              className="w-full"
              value={params.maximum_interval}
              onChange={(e) => updateParam("maximum_interval", parseInt(e.target.value, 10))}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Max days between reviews. Default: 365
            </p>
          </div>

          {/* Fuzz */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enable_fuzz"
              className="rounded"
              checked={params.enable_fuzz}
              onChange={(e) => updateParam("enable_fuzz", e.target.checked)}
            />
            <label htmlFor="enable_fuzz" className="text-xs">
              Enable fuzz (adds jitter to intervals for natural spacing)
            </label>
          </div>

          {/* Short term steps */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enable_short_term"
              className="rounded"
              checked={params.enable_short_term}
              onChange={(e) => updateParam("enable_short_term", e.target.checked)}
            />
            <label htmlFor="enable_short_term" className="text-xs">
              Enable short-term (re)learning steps
            </label>
          </div>

          {/* Learning steps (shown when enable_short_term) */}
          {params.enable_short_term && (
            <div>
              <label className="block text-xs font-medium mb-1">Learning steps</label>
              <input
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                value={(params.learning_steps as string[]).join(", ")}
                onChange={(e) =>
                  updateParam(
                    "learning_steps" as const,
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean) as any,
                  )
                }
                placeholder="1m, 10m"
              />
            </div>
          )}

          {/* Relearning steps */}
          {params.enable_short_term && (
            <div>
              <label className="block text-xs font-medium mb-1">Relearning steps</label>
              <input
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                value={(params.relearning_steps as string[]).join(", ")}
                onChange={(e) =>
                  updateParam(
                    "relearning_steps" as const,
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean) as any,
                  )
                }
                placeholder="10m"
              />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-destructive"
            onClick={resetParams}
          >
            Reset to defaults
          </Button>
          <Button size="sm" className="text-xs" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
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
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleLeft}>
            {leftCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <h1 className="flex-1 text-sm font-medium text-center">Siltflow</h1>
          <SettingsButton />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleRight}>
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
      <div className="flex h-10 items-center gap-1 border-b px-3">
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onToggleLeft}>
          {leftCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
        <h1 className="flex-1 text-sm font-medium truncate text-center min-w-0">
          {documentPath.split("/").pop()?.split("\\").pop()}
        </h1>
        <div className="flex items-center gap-0.5 shrink-0">
          <FitWidthButton />
          <SettingsButton />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleRight}>
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