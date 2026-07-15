import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconText } from "@/components/ui/icon-text";
import { Highlighter, FileText, Sparkles, CheckSquare } from "lucide-react";
import { useAnnotationStore } from "@/stores/annotation.store";
import { useAIStore } from "@/stores/ai.store";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import { useSummaryStore } from "@/stores/summary.store";
import { useDocumentStore } from "@/stores/document.store";
import { useToastStore } from "@/stores/toast.store";
import { extractPageTexts, summarizeSelectedPages } from "@/lib/summarize";
import { AnnotationsTab } from "@/components/layout/right-panel/annotations-tab";
import { SummaryTab } from "@/components/layout/right-panel/summary-tab";

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
  const defaultTargetLang = useAIStore((s) => s.defaultTargetLang);
  const setPageTexts = useSummaryStore((s) => s.setPageTexts);
  const setSelectedPages = useSummaryStore((s) => s.setSelectedPages);
  const scrollToHighlight = usePdfViewerStore((s) => s.scrollToHighlight);

  const [studyPanelOpen, setStudyPanelOpen] = useState(false);
  const [studyingIndex, setStudyingIndex] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const annotationsScrollRef = useRef<HTMLDivElement>(null);

  // When a highlight is clicked in the PDF, scroll the matching annotation card
  useEffect(() => {
    const handler = (e: Event) => {
      const { id } = (e as CustomEvent).detail;
      if (!id) return;
      onTabChange?.("annotations");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = annotationsScrollRef.current?.querySelector(
            `[data-annotation-id="${id}"]`,
          );
          if (el) {
            el.setAttribute("data-annotation-highlight", "true");
            setTimeout(() => el.removeAttribute("data-annotation-highlight"), 2000);
          }
          el?.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      });
    };
    window.addEventListener("siltflow:annotation-click", handler);
    return () => window.removeEventListener("siltflow:annotation-click", handler);
  }, [onTabChange]);

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

  const activeProfile = profiles.find((p) => p.active) ?? profiles[0] ?? null;

  const docId = currentDocument?.id;
  const summary = docId ? summaries[docId] : undefined;
  const texts = docId ? pageTexts[docId] : undefined;
  const selPages = docId ? selectedPages[docId] : undefined;
  const sourceLang = summary?.sourceLang ?? "en";
  const effectiveTargetLang =
    (docId && summaries?._targetLangs?.[docId]) || defaultTargetLang || "zh";

  const [summarizing, setSummarizing] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [, setExtracting] = useState(false);
  const [batchTranslating, setBatchTranslating] = useState(false);

  // Batch translate all untranslated annotations
  const handleBatchTranslate = useCallback(async () => {
    const untranslated = items.filter((i) => i.aiResult === undefined);
    if (untranslated.length === 0) {
      showToast("All annotations already translated", "info");
      return;
    }
    if (!activeProfile) {
      showToast("Please configure an AI provider in Settings > AI Config", "info");
      return;
    }
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
          const { translateAnnotation, extractArticleContext } = await import("@/lib/translate");
          const result = await translateAnnotation(activeProfile, {
            text: item.text,
            sourceLang,
            targetLang: effectiveTargetLang,
            contextSentence: item.text,
            context: summary?.text ?? extractArticleContext(texts ? texts.map((t) => t).join(" ") : ""),
          });
          updateItem(item.id, { aiResult: result, text: result.cleaned_input || item.text });
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Translation failed";
          showToast(`${message}`, "error");
          updateItem(item.id, { aiResult: undefined });
          return false;
        }
      }),
    );
    setBatchTranslating(false);
    const completed = results.filter(Boolean).length;
    if (completed > 0) showToast(`Translated ${completed} annotation${completed > 1 ? "s" : ""}`, "info");
  }, [items, activeProfile, summary, texts, updateItem, showToast, onTabChange, effectiveTargetLang, sourceLang]);

  // Extract page texts when a new pdfDocument arrives
  const docIdRef = useRef(docId);
  docIdRef.current = docId;
  const extractGen = useRef(0);

  useEffect(() => {
    if (!pdfDocument) return;
    const id = docIdRef.current;
    if (!id) return;
    if (pageTexts[id]) return;

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
    if (docId && texts && texts.length > 0 && selectedPages[docId] === undefined) {
      setSelectedPages(docId, [1]);
    }
  }, [docId, texts, selectedPages, setSelectedPages]);

  const numPages = currentDocument?.totalPages ?? texts?.length ?? 0;

  const allSelected = selPages === undefined || selPages.length === numPages;

  const togglePage = useCallback(
    (pageNum: number) => {
      if (!docId || !numPages) return;
      const current = selPages ?? Array.from({ length: numPages }, (_, i) => i + 1);
      if (current.includes(pageNum) && current.length === 1) return;
      const next = current.includes(pageNum)
        ? current.filter((p) => p !== pageNum)
        : [...current, pageNum].sort((a, b) => a - b);
      setSelectedPages(docId, next.length === numPages ? Array.from({ length: numPages }, (_, i) => i + 1) : next);
    },
    [docId, numPages, selPages, setSelectedPages],
  );

  const toggleAll = useCallback(() => {
    if (!docId || !numPages) return;
    if (allSelected) setSelectedPages(docId, []);
    else setSelectedPages(docId, Array.from({ length: numPages }, (_, i) => i + 1));
  }, [docId, numPages, allSelected, setSelectedPages]);

  const handleSummarize = useCallback(async () => {
    if (!docId || !texts) {
      showToast("Open a document first", "info");
      return;
    }
    if (!activeProfile) {
      showToast("Please configure an AI provider in Settings > AI Config", "info");
      return;
    }

    const pagesToSummarize = selPages ?? texts.map((_, i) => i + 1);
    if (pagesToSummarize.length === 0) {
      showToast("Select at least one page", "info");
      return;
    }

    setSummarizing(true);
    try {
      const result = await summarizeSelectedPages(activeProfile, texts, pagesToSummarize);
      setSummary(docId, result.summary, true, result.sourceLang, result.keyVocabulary, result.gist);
      showToast("Summary generated", "info");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Summarization failed";
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
            <TabsTrigger value="annotations" className="flex-1 text-xs px-2 py-0.5 h-6">
              <IconText icon={Highlighter} size="xs">Annotations</IconText>
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex-1 text-xs px-2 py-0.5 h-6" disabled={!docId}>
              <IconText icon={FileText} size="xs">Summary</IconText>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="annotations" className="flex-1 min-h-0 mt-0 flex flex-col">
          <AnnotationsTab
            items={items}
            profiles={profiles}
            activeProfile={activeProfile}
            docId={docId}
            summary={summary}
            texts={texts}
            selPages={selPages}
            sourceLang={sourceLang}
            effectiveTargetLang={effectiveTargetLang}
            onTabChange={onTabChange}
            annotationsScrollRef={annotationsScrollRef}
            expandedCardId={expandedCardId}
            setExpandedCardId={setExpandedCardId}
            scrollToHighlight={scrollToHighlight}
            handleStartLearning={handleStartLearning}
            dueItems={dueItems}
            dueCount={dueCount}
            batchTranslating={batchTranslating}
            handleBatchTranslate={handleBatchTranslate}
            studyPanelOpen={studyPanelOpen}
            studyingIndex={studyingIndex}
            answerRevealed={answerRevealed}
            setAnswerRevealed={setAnswerRevealed}
            setStudyingIndex={setStudyingIndex}
            onCloseStudyPanel={() => setStudyPanelOpen(false)}
          />
        </TabsContent>

        <TabsContent value="summary" className="flex-1 min-h-0 mt-0 flex flex-col">
          <SummaryTab
            docId={docId}
            numPages={numPages}
            selPages={selPages}
            allSelected={allSelected}
            togglePage={togglePage}
            toggleAll={toggleAll}
            summarizing={summarizing}
            handleSummarize={handleSummarize}
            editingSummary={editingSummary}
            setEditingSummary={setEditingSummary}
            summary={summary}
            handleEditSummary={handleEditSummary}
            handleClearSummary={handleClearSummary}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
