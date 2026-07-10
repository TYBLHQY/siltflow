import { useState, useCallback, useEffect, useRef } from "react"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Highlighter,
  Sparkles,
  Loader2,
  FileText,
  Pencil,
  CheckSquare,
  Square,
  Trash2,
  Bot,
} from "lucide-react"
import { useAnnotationStore } from "@/stores/annotation.store"
import { useAIStore } from "@/stores/ai.store"
import { usePdfViewerStore } from "@/stores/pdf-viewer.store"
import { useSummaryStore } from "@/stores/summary.store"
import { useDocumentStore } from "@/stores/document.store"
import { useStyleStore } from "@/stores/style.store"
import { useToastStore } from "@/stores/toast.store"
import { AITranslateCard } from "@/components/document/AITranslateCard"
import { KnuthPlassText } from "@/components/ui/KnuthPlassText"
import { extractPageTexts, summarizeSelectedPages } from "@/lib/summarize"

export function RightPanel() {
  const items = useAnnotationStore((s) => s.items)
  const profiles = useAIStore((s) => s.profiles)
  const removeItem = useAnnotationStore((s) => s.removeItem)
  const updateItem = useAnnotationStore((s) => s.updateItem)
  const showToast = useToastStore((s) => s.show)

  const currentDocument = useDocumentStore((s) => s.currentDocument)
  const pdfDocument = usePdfViewerStore((s) => s.pdfDocument)
  const summaries = useSummaryStore((s) => s.summaries)
  const pageTexts = useSummaryStore((s) => s.pageTexts)
  const selectedPages = useSummaryStore((s) => s.selectedPages)
  const setSummary = useSummaryStore((s) => s.setSummary)
  const clearSummary = useSummaryStore((s) => s.clearSummary)
  const setPageTexts = useSummaryStore((s) => s.setPageTexts)
  const setSelectedPages = useSummaryStore((s) => s.setSelectedPages)
  const style = useStyleStore((s) => s.style)

  /** Get the active profile from the store's raw state */
  const activeProfile = profiles.find((p) => p.active) ?? profiles[0] ?? null

  const docId = currentDocument?.id
  const summary = docId ? summaries[docId] : undefined
  const texts = docId ? pageTexts[docId] : undefined
  const selPages = docId ? selectedPages[docId] : undefined

  const [summarizing, setSummarizing] = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const extractedRef = useRef<string | null>(null)

  // Extract page texts when document changes
  useEffect(() => {
    if (!docId || !pdfDocument) return
    if (pageTexts[docId]) return // already cached
    if (extractedRef.current === docId) return

    extractedRef.current = docId
    setExtracting(true)
    extractPageTexts(pdfDocument)
      .then((texts) => {
        setPageTexts(docId, texts)
      })
      .catch((err) => {
        console.error("Failed to extract page texts:", err)
      })
      .finally(() => setExtracting(false))
  }, [docId, pdfDocument, pageTexts, setPageTexts])

  // When page texts are first loaded, select only the first page by default
  useEffect(() => {
    if (docId && texts && texts.length > 0 && selectedPages[docId] === undefined) {
      setSelectedPages(docId, [1])
    }
  }, [docId, texts, selectedPages, setSelectedPages])

  const allSelected = texts && selPages && selPages.length === texts.length

  const togglePage = useCallback(
    (pageNum: number) => {
      if (!docId || !texts) return
      const current = selPages ?? texts.map((_, i) => i + 1)
      const next = current.includes(pageNum)
        ? current.filter((p) => p !== pageNum)
        : [...current, pageNum].sort((a, b) => a - b)
      setSelectedPages(docId, next.length === texts.length ? undefined : next)
    },
    [docId, texts, selPages, setSelectedPages],
  )

  const toggleAll = useCallback(() => {
    if (!docId || !texts) return
    if (allSelected) {
      setSelectedPages(docId, [])
    } else {
      setSelectedPages(docId, texts.map((_, i) => i + 1))
    }
  }, [docId, texts, allSelected, setSelectedPages])

  const handleSummarize = useCallback(async () => {
    if (!docId || !texts) {
      showToast("Open a document first", "info")
      return
    }
    if (!activeProfile) {
      showToast("Please configure an AI provider in Settings > AI Config", "info")
      return
    }

    const pagesToSummarize = selPages ?? texts.map((_, i) => i + 1)
    if (pagesToSummarize.length === 0) {
      showToast("Select at least one page", "info")
      return
    }

    setSummarizing(true)
    try {
      const result = await summarizeSelectedPages(activeProfile, texts, pagesToSummarize)
      setSummary(docId, result, true)
      showToast("Summary generated", "info")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Summarization failed"
      showToast(message, "error")
    } finally {
      setSummarizing(false)
    }
  }, [docId, texts, selPages, activeProfile, setSummary, showToast])

  const handleEditSummary = useCallback(
    (text: string) => {
      if (!docId) return
      setSummary(docId, text, false)
    },
    [docId, setSummary],
  )

  const handleClearSummary = useCallback(() => {
    if (!docId) return
    clearSummary(docId)
    setEditingSummary(false)
  }, [docId, clearSummary])

  const numPages = texts?.length ?? 0

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="annotations" className="flex flex-col flex-1 min-h-0">
        <div className="border-b px-3 py-1.5">
          <TabsList className="h-7">
            <TabsTrigger value="annotations" className="text-xs px-2 py-0.5 h-6">
              <Highlighter className="h-3.5 w-3.5 mr-1" />
              Annotations
              {items.length > 0 && (
                <span className="ml-1 text-[10px] tabular-nums">{items.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="summary"
              className="text-xs px-2 py-0.5 h-6"
              disabled={!docId}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Summary
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Annotations tab ── */}
        <TabsContent value="annotations" className="flex-1 min-h-0 mt-0 flex flex-col">
          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground px-4">
              <Highlighter className="h-8 w-8 mb-2" />
              <p className="text-xs text-center">
                Highlight text in the document to add annotations
              </p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-0">
                {items.map((ann) => (
                  <AITranslateCard
                    key={ann.id}
                    id={ann.id}
                    item={ann}
                    onDelete={(id) => {
                      window.siltflow.annotations.delete(id)
                      removeItem(id)
                    }}
                    onTranslate={async (id) => {
                      const item = items.find((i) => i.id === id)
                      if (!item || item.aiResult !== undefined) return

                      const profile = activeProfile
                      if (!profile) {
                        showToast("Please configure an AI provider in Settings > AI Config", "info")
                        return
                      }

                      updateItem(id, { aiResult: null })

                      try {
                        const { translateAnnotation } = await import("@/lib/translate")
                        const result = await translateAnnotation(profile, {
                          text: item.text,
                          targetLang: "zh",
                        })
                        updateItem(id, { aiResult: result })
                      } catch (err) {
                        const message = err instanceof Error ? err.message : "Translation failed"
                        showToast(message, "error")
                        updateItem(id, { aiResult: undefined })
                      }
                    }}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
          <Separator />
        </TabsContent>

        {/* ── Summary tab ── */}
        <TabsContent value="summary" className="flex-1 min-h-0 mt-0 flex flex-col">
          {extracting ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting page text&hellip;
            </div>
          ) : texts && texts.length > 0 ? (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Page selection */}
              <div className="border-b px-3 py-2 space-y-1">
                <button
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={toggleAll}
                >
                  {allSelected ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  {numPages} pages
                  {selPages !== undefined && (
                    <span className="text-[10px] text-muted-foreground">
                      ({selPages.length} selected)
                    </span>
                  )}
                </button>
                <ScrollArea className="max-h-32">
                  <div className="flex flex-wrap gap-1">
                    {texts.map((_, i) => {
                      const p = i + 1
                      const selected = selPages === undefined || selPages.includes(p)
                      return (
                        <button
                          key={p}
                          className={`inline-flex items-center justify-center h-6 min-w-[24px] rounded px-1 text-[10px] font-medium transition-colors ${
                            selected
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent"
                          }`}
                          onClick={() => togglePage(p)}
                        >
                          {p}
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>

                <button
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 w-full justify-center"
                  onClick={handleSummarize}
                  disabled={summarizing || !activeProfile}
                >
                  {summarizing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {summarizing
                    ? "Summarizing&hellip;"
                    : summary
                      ? "Regenerate"
                      : "AI Summarize"}
                </button>
              </div>

              {/* Summary toolbar (fixed at top when summary exists) */}
              {summary && (
                <div className="flex items-center gap-2 border-b px-3 py-1.5 shrink-0">
                  {editingSummary ? (
                    <>
                      <button
                        className="ml-auto rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        onClick={() => setEditingSummary(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
                        onClick={() => setEditingSummary(false)}
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingSummary(true)}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      {summary.isAiGenerated && (
                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                          <Bot className="h-2.5 w-2.5" />
                          AI-generated
                        </span>
                      )}
                      <button
                        className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive"
                        onClick={handleClearSummary}
                      >
                        <Trash2 className="h-3 w-3" />
                        Clear
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Summary content */}
              <div className="flex-1 min-h-0">
                {summary ? (
                  editingSummary ? (
                    <textarea
                      className="h-full w-full resize-none border-0 bg-background p-3 leading-relaxed"
                      style={{
                        fontFamily: style.fontFamily,
                        fontSize: style.fontSize,
                      }}
                      value={summary.text}
                      onChange={(e) => handleEditSummary(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <div className="h-full overflow-y-auto px-3 py-3">
                      <KnuthPlassText
                        text={summary.text}
                        className="text-xs text-foreground rounded-md border border-transparent px-2 py-1.5"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4 gap-1">
                    <FileText className="h-8 w-8 mb-1" />
                    <p className="text-xs text-center">
                      Select pages above and click AI Summarize
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground px-4">
              <p className="text-xs text-center">No document text available</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
