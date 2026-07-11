import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconText } from "@/components/ui/icon-text";
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
} from "lucide-react";
import { useAnnotationStore } from "@/stores/annotation.store";
import { useAIStore } from "@/stores/ai.store";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import { useSummaryStore } from "@/stores/summary.store";
import { useDocumentStore } from "@/stores/document.store";
import { useStyleStore, buildFontStack } from "@/stores/style.store";
import { useToastStore } from "@/stores/toast.store";
import { AITranslateCard } from "@/components/document/AITranslateCard";
import { LearningModal } from "@/components/document/LearningModal";
import { KnuthPlassText } from "@/components/ui/KnuthPlassText";
import { extractPageTexts, summarizeSelectedPages } from "@/lib/summarize";
import { reviewAnnotation } from "@/stores/fsrs.store";
import type { Grade } from "ts-fsrs";
import { useShortcut } from "@/hooks/useShortcut";

interface RightPanelProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function RightPanel({ activeTab, onTabChange }: RightPanelProps) {
  const items = useAnnotationStore((s) => s.items);
  const profiles = useAIStore((s) => s.profiles);
  const removeItem = useAnnotationStore((s) => s.removeItem);
  const updateItem = useAnnotationStore((s) => s.updateItem);
  const showToast = useToastStore((s) => s.show);

  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const pdfDocument = usePdfViewerStore((s) => s.pdfDocument);
  const summaries = useSummaryStore((s) => s.summaries);
  const pageTexts = useSummaryStore((s) => s.pageTexts);
  const selectedPages = useSummaryStore((s) => s.selectedPages);
  const setSummary = useSummaryStore((s) => s.setSummary);
  const clearSummary = useSummaryStore((s) => s.clearSummary);
  const targetLangs = useSummaryStore((s) => s.targetLangs);
  const setTargetLang = useSummaryStore((s) => s.setTargetLang);
  const defaultTargetLang = useAIStore((s) => s.defaultTargetLang);
  const setPageTexts = useSummaryStore((s) => s.setPageTexts);
  const setSelectedPages = useSummaryStore((s) => s.setSelectedPages);
  const style = useStyleStore((s) => s.style);
  const scrollToHighlight = usePdfViewerStore((s) => s.scrollToHighlight);

  const [studyPanelOpen, setStudyPanelOpen] = useState(false);
  const [studyingIndex, setStudyingIndex] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Compute due annotations for the study panel
  const dueItems = useMemo(
    () =>
      items.filter((item) => {
        if (!item.fsrsCard) return true;
        try {
          const d =
            item.fsrsCard.due instanceof Date
              ? item.fsrsCard.due
              : new Date(item.fsrsCard.due);
          return d <= new Date();
        } catch {
          return true;
        }
      }),
    [items],
  );
  const dueCount = dueItems.length;

  const handleStartLearning = useCallback(() => {
    if (dueItems.length === 0) {
      showToast("No due annotations", "info");
      return;
    }
    setStudyingIndex(0);
    setAnswerRevealed(false);
    setStudyPanelOpen(true);
  }, [dueItems, showToast]);

  // Shortcut: ctrl+s to start learning when a PDF is open
  const hasPdf = !!currentDocument?.id;
  useShortcut("startLearning", handleStartLearning, {
    enabled: hasPdf && !studyPanelOpen,
  });

  /** Get the active profile from the store's raw state */
  const activeProfile = profiles.find((p) => p.active) ?? profiles[0] ?? null;

  const docId = currentDocument?.id;
  const summary = docId ? summaries[docId] : undefined;
  const texts = docId ? pageTexts[docId] : undefined;
  const selPages = docId ? selectedPages[docId] : undefined;
  const sourceLang = summary?.sourceLang ?? "en";
  const effectiveTargetLang =
    (docId && targetLangs[docId]) || defaultTargetLang || "zh";

  const [summarizing, setSummarizing] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const setExtracting = useState(false)[1];
  const [batchTranslating, setBatchTranslating] = useState(false);

  // Batch translate all untranslated annotations
  const handleBatchTranslate = useCallback(async () => {
    const untranslated = items.filter((i) => i.aiResult === undefined);
    if (untranslated.length === 0) {
      showToast("All annotations already translated", "info");
      return;
    }
    if (!activeProfile) {
      showToast(
        "Please configure an AI provider in Settings > AI Config",
        "info",
      );
      return;
    }

    // Require summary before batch translate — jump to Summary tab if missing
    if (!summary || !summary.text?.trim()) {
      showToast("Please generate a summary first", "info");
      onTabChange?.("summary");
      return;
    }

    setBatchTranslating(true);
    const results = await Promise.all(
      untranslated.map(async (item) => {
        updateItem(item.id, { aiResult: null });
        try {
          const { translateAnnotation, extractArticleContext } =
            await import("@/lib/translate");
          const result = await translateAnnotation(activeProfile, {
            text: item.text,
            sourceLang,
            targetLang: effectiveTargetLang,
            contextSentence: item.text,
            context:
              summary?.text ??
              extractArticleContext(texts ? texts.map((t) => t).join(" ") : ""),
          });
          updateItem(item.id, {
            aiResult: result,
            text: result.cleaned_input || item.text,
          });
          return true;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Translation failed";
          showToast(`${message}`, "error");
          updateItem(item.id, { aiResult: undefined });
          return false;
        }
      }),
    );
    setBatchTranslating(false);
    const completed = results.filter(Boolean).length;
    if (completed > 0) {
      showToast(
        `Translated ${completed} annotation${completed > 1 ? "s" : ""}`,
        "info",
      );
    }
  }, [
    items,
    activeProfile,
    summary,
    texts,
    updateItem,
    showToast,
    onTabChange,
    effectiveTargetLang,
    sourceLang,
  ]);

  // Extract page texts when a new pdfDocument arrives.
  // Only depend on pdfDocument — docId flips before the PDF settles and
  // does not need to re-trigger extraction.
  const docIdRef = useRef(docId);
  docIdRef.current = docId;
  const extractGen = useRef(0);

  useEffect(() => {
    if (!pdfDocument) return;
    const id = docIdRef.current;
    if (!id) return;
    if (pageTexts[id]) return; // already cached — nothing to do

    const gen = ++extractGen.current;
    setExtracting(true);

    extractPageTexts(pdfDocument)
      .then((texts) => {
        if (gen !== extractGen.current) return;
        setPageTexts(id, texts);
      })
      .catch((err) => {
        if (gen !== extractGen.current) return;
        console.error("Failed to extract page texts:", err);
      })
      .finally(() => {
        if (gen === extractGen.current) setExtracting(false);
      });
  }, [pdfDocument, pageTexts, setExtracting, setPageTexts]);

  // When page texts are first loaded, select only the first page by default
  useEffect(() => {
    if (
      docId &&
      texts &&
      texts.length > 0 &&
      selectedPages[docId] === undefined
    ) {
      setSelectedPages(docId, [1]);
    }
  }, [docId, texts, selectedPages, setSelectedPages]);

  const numPages = currentDocument?.totalPages ?? texts?.length ?? 0;

  const allSelected = selPages === undefined || selPages.length === numPages;

  const togglePage = useCallback(
    (pageNum: number) => {
      if (!docId || !numPages) return;
      const current =
        selPages ?? Array.from({ length: numPages }, (_, i) => i + 1);
      const next = current.includes(pageNum)
        ? current.filter((p) => p !== pageNum)
        : [...current, pageNum].sort((a, b) => a - b);
      setSelectedPages(docId, next.length === numPages ? undefined : next);
    },
    [docId, numPages, selPages, setSelectedPages],
  );

  const toggleAll = useCallback(() => {
    if (!docId || !numPages) return;
    if (allSelected) {
      setSelectedPages(docId, []);
    } else {
      setSelectedPages(
        docId,
        Array.from({ length: numPages }, (_, i) => i + 1),
      );
    }
  }, [docId, numPages, allSelected, setSelectedPages]);

  const handleSummarize = useCallback(async () => {
    if (!docId || !texts) {
      showToast("Open a document first", "info");
      return;
    }
    if (!activeProfile) {
      showToast(
        "Please configure an AI provider in Settings > AI Config",
        "info",
      );
      return;
    }

    const pagesToSummarize = selPages ?? texts.map((_, i) => i + 1);
    if (pagesToSummarize.length === 0) {
      showToast("Select at least one page", "info");
      return;
    }

    setSummarizing(true);
    try {
      const result = await summarizeSelectedPages(
        activeProfile,
        texts,
        pagesToSummarize,
      );
      setSummary(
        docId,
        result.summary,
        true,
        result.sourceLang,
        result.keyVocabulary,
        result.gist,
      );
      showToast("Summary generated", "info");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Summarization failed";
      showToast(message, "error");
    } finally {
      setSummarizing(false);
    }
  }, [docId, texts, selPages, activeProfile, setSummary, showToast]);

  const handleEditSummary = useCallback(
    (text: string) => {
      if (!docId) return;
      setSummary(docId, text, false);
    },
    [docId, setSummary],
  );

  const handleClearSummary = useCallback(() => {
    if (!docId) return;
    clearSummary(docId);
    setEditingSummary(false);
  }, [docId, clearSummary]);

  return (
    <div className="flex h-full flex-col">
      <Tabs
        defaultValue="annotations"
        value={activeTab ?? undefined}
        onValueChange={onTabChange}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="flex h-10 items-center border-b px-3">
          <TabsList className="w-full h-7 text-foreground">
            <TabsTrigger
              value="annotations"
              className="flex-1 text-xs px-2 py-0.5 h-6"
            >
              <IconText icon={Highlighter} size="xs">
                Annotations
              </IconText>
            </TabsTrigger>
            <TabsTrigger
              value="summary"
              className="flex-1 text-xs px-2 py-0.5 h-6"
              disabled={!docId}
            >
              <IconText icon={FileText} size="xs">
                Summary
              </IconText>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Annotations tab ── */}
        <TabsContent
          value="annotations"
          className="flex-1 min-h-0 mt-0 flex flex-col"
        >
          {items.length > 0 && (
            <div className="shrink-0 border-b px-3 py-2 flex flex-col gap-1.5">
              <button
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                onClick={handleStartLearning}
              >
                <IconText icon={CheckSquare} size="xs" className="gap-0">
                  Start Learning ({dueCount})
                </IconText>
              </button>
              <button
                className="flex w-full items-center justify-center gap-1 rounded-md border border-border/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                onClick={handleBatchTranslate}
                disabled={batchTranslating}
                title="Translate all untranslated annotations"
              >
                <IconText icon={Sparkles} size="xs" className="gap-0">
                  {batchTranslating ? "Translating..." : "Batch Translate"}
                </IconText>
              </button>
            </div>
          )}
          {items.length > 0 && docId && (
            <div className="shrink-0 flex items-center gap-2 border-b px-3 py-1.5 text-xs">
              {/* Source language — select */}
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="font-medium">Source:</span>
                <select
                  className="bg-transparent text-foreground border-b border-dotted border-border/50 outline-none text-xs"
                  value={sourceLang}
                  onChange={(e) => {
                    if (docId && summary) {
                      useSummaryStore
                        .getState()
                        .setSummary(
                          docId,
                          summary.text,
                          summary.isAiGenerated,
                          e.target.value,
                        );
                    }
                  }}
                >
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                  <option value="ja">日本語</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="es">Español</option>
                  <option value="ko">한국어</option>
                  <option value="ru">Русский</option>
                  <option value="auto">Auto</option>
                </select>
              </span>
              {/* Target language — select */}
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="font-medium">Target:</span>
                <select
                  className="bg-transparent text-foreground border-b border-dotted border-border/50 outline-none text-xs"
                  value={effectiveTargetLang}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__default__") return;
                    if (docId) setTargetLang(docId, val);
                  }}
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="es">Español</option>
                  <option value="ko">한국어</option>
                  <option value="ru">Русский</option>
                  <option value="__default__">
                    Default ({defaultTargetLang || "zh"})
                  </option>
                </select>
              </span>
            </div>
          )}
          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground px-4">
              <Highlighter className="h-8 w-8 mb-2" />
              <p className="text-xs text-center">
                Highlight text in the document to add annotations
              </p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div
                className="space-y-2 p-3"
                style={{ width: 0, minWidth: "100%" }}
              >
                {[...items]
                  .sort((a, b) => {
                    if (a.pageNumber !== b.pageNumber)
                      return a.pageNumber - b.pageNumber;
                    const topA = a.embedData?.position?.boundingRect?.y1 ?? 0;
                    const topB = b.embedData?.position?.boundingRect?.y1 ?? 0;
                    return topA - topB;
                  })
                  .map((ann) => (
                    <AITranslateCard
                      key={ann.id}
                      id={ann.id}
                      item={ann}
                      scrolled={false}
                      expanded={expandedCardId === ann.id}
                      onToggleExpand={(id) => setExpandedCardId(id)}
                      onClick={() => scrollToHighlight?.(ann.id)}
                      onDelete={(id) => {
                        removeItem(id);
                      }}
                      onTranslate={async (id) => {
                        const item = items.find((i) => i.id === id);
                        if (!item || item.aiResult !== undefined) return;

                        const profile = activeProfile;
                        if (!profile) {
                          showToast(
                            "Please configure an AI provider in Settings > AI Config",
                            "info",
                          );
                          return;
                        }

                        // Require summary
                        if (!summary || !summary.text?.trim()) {
                          showToast("Please generate a summary first", "info");
                          onTabChange?.("summary");
                          return;
                        }

                        updateItem(id, { aiResult: null });

                        try {
                          const { translateAnnotation, extractArticleContext } =
                            await import("@/lib/translate");
                          const result = await translateAnnotation(profile, {
                            text: item.text,
                            sourceLang,
                            targetLang: effectiveTargetLang,
                            contextSentence: item.text,
                            context:
                              summary?.text ??
                              extractArticleContext(
                                (texts ?? []).map((t) => t).join(" "),
                              ),
                          });
                          updateItem(id, {
                            aiResult: result,
                            text: result.cleaned_input || item.text,
                          });
                        } catch (err) {
                          const message =
                            err instanceof Error
                              ? err.message
                              : "Translation failed";
                          showToast(message, "error");
                          updateItem(id, { aiResult: undefined });
                        }
                      }}
                    />
                  ))}
              </div>
            </ScrollArea>
          )}

          {/* Start Learning overlay modal */}
          <LearningModal
            items={studyPanelOpen ? dueItems : []}
            studyingIndex={studyingIndex}
            answerRevealed={answerRevealed}
            setAnswerRevealed={setAnswerRevealed}
            onRate={(grade) => {
              const item = dueItems[studyingIndex];
              if (item) {
                reviewAnnotation(item.id, grade as Grade);
              }
              if (studyingIndex + 1 < dueItems.length) {
                setStudyingIndex((i) => i + 1);
                setAnswerRevealed(false);
              } else {
                showToast("All cards reviewed! Good job!", "success");
              }
            }}
            onClose={() => setStudyPanelOpen(false)}
          />
        </TabsContent>
        <TabsContent
          value="summary"
          className="flex-1 min-h-0 mt-0 flex flex-col"
        >
          {numPages > 0 ? (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Page selection — available immediately from totalPages */}
              <div className="border-b px-3 py-2 space-y-1">
                <button
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={toggleAll}
                >
                  {allSelected ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <Square className="h-3.5 w-3.5 shrink-0" />
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
                    {Array.from({ length: numPages }, (_, i) => {
                      const p = i + 1;
                      const selected =
                        selPages === undefined || selPages.includes(p);
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
                      );
                    })}
                  </div>
                </ScrollArea>

                <button
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 w-full justify-center"
                  onClick={handleSummarize}
                  disabled={summarizing || !activeProfile}
                >
                  {summarizing ? (
                    <IconText icon={Loader2} size="xs" className="gap-0">
                      Summarizing…
                    </IconText>
                  ) : (
                    <IconText icon={Sparkles} size="xs" className="gap-0">
                      {summary ? "Regenerate" : "AI Summarize"}
                    </IconText>
                  )}
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
                        fontFamily: buildFontStack(style.fontFamilies),
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
  );
}
