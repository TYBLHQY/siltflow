import { Button } from "@/components/ui/button";
import { Highlighter, CheckSquare, Sparkles, ArrowUpCircle, Plus } from "lucide-react";
import { useState, useCallback, useMemo, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconText } from "@/components/ui/icon-text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AITranslateCard } from "@/components/document/AITranslateCard";
import { LearningModal } from "@/components/document/LearningModal";
import { useAnnotationStore } from "@/stores/annotation.store";
import { useSummaryStore } from "@/stores/summary.store";
import { useDocumentStore } from "@/stores/document.store";
import { useAIStore } from "@/stores/ai.store";
import { pdfScrollToHighlight } from "@/stores/pdf-viewer.store";
import { useToastStore } from "@/stores/toast.store";
import { useShortcut } from "@/hooks/useShortcut";
import { useNow } from "@/hooks/useNow";
import { reviewAnnotation } from "@/stores/fsrs.store";
import { cardDueDate } from "@/lib/fsrs-utils";
import type { Grade } from "ts-fsrs";
import { LANGUAGES, LANGUAGES_WITH_AUTO } from "@/lib/languages";
import type { AnnotationItem } from "@/stores/annotation.store";

interface AnnotationsTabProps {
  onTabChange?: (tab: string) => void;
  annotationsScrollRef: React.RefObject<HTMLDivElement | null>;
}

// ── V2 shared translation helper ──────────────────────────────────────
// V1 translate (single AI call for AIAnnotationDataV1) is no longer active.
// All new translations use the V2 two-stage pipeline below.

async function translateItemV2(
  item: { id: string; text: string },
  sourceLang: string,
  targetLang: string,
  summary: string | undefined,
  texts: string[] | undefined,
  updateItem: (id: string, patch: Partial<AnnotationItem>) => void,
  showToast: (message: string, type: "info" | "success" | "error") => void,
): Promise<boolean> {
  const inputProfile = useAIStore.getState().getProfileForTask("translate-input");
  const outputProfile = useAIStore.getState().getProfileForTask("translate-output");
  if (!inputProfile || !outputProfile) {
    showToast(
      "Please configure AI providers in Settings > AI Config",
      "info",
    );
    return false;
  }

  updateItem(item.id, { aiResult: null });
  try {
    const { translateAnnotationV2 } = await import("@/lib/translate-v2");
    const { extractArticleContext } = await import("@/lib/translate");
    const context = summary ?? extractArticleContext((texts ?? []).join(" "));
    const result = await translateAnnotationV2({
      inputProfile,
      outputProfile,
      text: item.text,
      sourceLang,
      targetLang,
      context,
    });
    updateItem(item.id, {
      aiResult: result,
      text: result.input.normalized || item.text,
      aiVersion: 2,
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Translation failed";
    showToast(message, "error");
    updateItem(item.id, { aiResult: undefined });
    return false;
  }
}

export function AnnotationsTab({
  onTabChange,
  annotationsScrollRef,
}: AnnotationsTabProps) {
  // ── Store reads ────────────────────────────────────────────────────
  const allItems = useAnnotationStore((s) => s.items);
  // Only show annotation-kind items in this panel; plain highlights are visual only.
  const items = useMemo(() => allItems.filter((i) => i.kind !== "highlight"), [allItems]);
  const updateItem = useAnnotationStore((s) => s.updateItem);
  const removeItem = useAnnotationStore((s) => s.removeItem);
  const addItem = useAnnotationStore((s) => s.addItem);
  const showToast = useToastStore((s) => s.show);
  const defaultTargetLang = useAIStore((s) => s.defaultTargetLang);
  const summaries = useSummaryStore((s) => s.summaries);
  const pageTexts = useSummaryStore((s) => s.pageTexts);
  const targetLangs = useSummaryStore((s) => s.targetLangs);
  const setTargetLang = useSummaryStore((s) => s.setTargetLang);
  const currentDocument = useDocumentStore((s) => s.currentDocument);

  const docId = currentDocument?.id;
  const summary = docId ? summaries[docId] : undefined;
  const texts = docId ? pageTexts[docId] : undefined;
  const sourceLang = summary?.sourceLang ?? "en-US";
  const effectiveTargetLang =
    (docId && targetLangs[docId]) || defaultTargetLang || "zh-CN";

  // ── Local state ────────────────────────────────────────────────────
  const [studyPanelOpen, setStudyPanelOpen] = useState(false);
  const [studyingIndex, setStudyingIndex] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [batchTranslating, setBatchTranslating] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  // Manual annotation dialog
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  // Snapshot of dueItems taken when the learning session starts.
  // This is stable throughout the session so rating items (which
  // changes their due dates) doesn't shift indices and skip cards.
  const [sessionItems, setSessionItems] = useState<AnnotationItem[]>([]);

  // ── Start Learning shortcut ────────────────────────────────────────
  const hasPdf = !!currentDocument?.id;
  const now = useNow(15_000);
  const dueItems = useMemo(
    () =>
      items.filter((item) => {
        if (!item.fsrsCard) return true;
        try {
          return cardDueDate(item.fsrsCard).getTime() <= now;
        } catch {
          return true;
        }
      }),
    [items, now],
  );
  const dueCount = dueItems.length;

  const untranslatedCount = useMemo(
    () => items.filter((i) => i.aiResult === undefined).length,
    [items],
  );

  const v1Count = useMemo(
    () =>
      items.filter((i) => i.aiResult !== undefined && i.aiResult !== null && i.aiVersion !== 2)
        .length,
    [items],
  );

  const handleStartLearning = useCallback(() => {
    if (dueItems.length === 0) {
      showToast("No due annotations", "info");
      return;
    }
    // Snapshot the due items so the session queue is stable —
    // rating a card changes its due date, which would otherwise
    // remove it from the live useMemo and shift indices.
    setSessionItems([...dueItems]);
    setStudyingIndex(0);
    setAnswerRevealed(false);
    setStudyPanelOpen(true);
  }, [dueItems, showToast]);

  useShortcut("startLearning", handleStartLearning, {
    enabled: hasPdf && !studyPanelOpen,
  });

  // ── Expand V2 card when PDF highlight is clicked ──────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      if (id) setExpandedCardId(id);
    };
    window.addEventListener("siltflow:annotation-click", handler);
    return () =>
      window.removeEventListener("siltflow:annotation-click", handler);
  }, []);

  // ── Batch translate ────────────────────────────────────────────────
  const handleBatchTranslate = useCallback(async () => {
    const untranslated = items.filter((i) => i.aiResult === undefined);
    if (untranslated.length === 0) {
      showToast("All annotations already translated", "info");
      return;
    }
    if (!summary || !summary.text?.trim()) {
      showToast("Please generate a summary first", "info");
      onTabChange?.("summary");
      return;
    }

    setBatchTranslating(true);
    const results = await Promise.all(
      untranslated.map((item) =>
        translateItemV2(
          item,
          sourceLang,
          effectiveTargetLang,
          summary?.text || undefined,
          texts,
          updateItem,
          showToast,
        ),
      ),
    );
    setBatchTranslating(false);
    const completed = results.filter(Boolean).length;
    if (completed > 0)
      showToast(
        `Translated ${completed} annotation${completed > 1 ? "s" : ""}`,
        "info",
      );
  }, [
    items,
    summary,
    texts,
    updateItem,
    showToast,
    onTabChange,
    effectiveTargetLang,
    sourceLang,
  ]);

  // ── Upgrade V1 → V2 ──────────────────────────────────────────────────
  const handleUpgradeV1ToV2 = useCallback(async () => {
    const v1Items = items.filter(
      (i) => i.aiResult !== undefined && i.aiResult !== null && i.aiVersion !== 2,
    );
    if (v1Items.length === 0) {
      showToast("All annotations are already V2", "info");
      return;
    }
    if (!summary || !summary.text?.trim()) {
      showToast("Please generate a summary first", "info");
      onTabChange?.("summary");
      return;
    }

    setUpgrading(true);
    const results = await Promise.all(
      v1Items.map((item) =>
        translateItemV2(
          item,
          sourceLang,
          effectiveTargetLang,
          summary?.text || undefined,
          texts,
          updateItem,
          showToast,
        ),
      ),
    );
    setUpgrading(false);
    const completed = results.filter(Boolean).length;
    if (completed > 0)
      showToast(
        `Upgraded ${completed} annotation${completed > 1 ? "s" : ""} to V2`,
        "info",
      );
  }, [
    items,
    summary,
    texts,
    updateItem,
    showToast,
    onTabChange,
    effectiveTargetLang,
    sourceLang,
  ]);

  // ── Manual annotation creation ────────────────────────────────────
  const handleCreateManual = useCallback(() => {
    const trimmed = manualText.trim();
    if (!trimmed || !docId) return;
    const item: AnnotationItem = {
      id: crypto.randomUUID(),
      documentId: docId,
      type: "text",
      kind: "manual",
      text: trimmed,
      pageNumber: 0,
      embedData: {
        position: {
          boundingRect: {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0,
            width: 0,
            height: 0,
            pageNumber: 0,
          },
          rects: [],
        },
        content: { text: trimmed },
      },
    };
    addItem(item);
    setManualText("");
    setManualDialogOpen(false);
  }, [manualText, docId, addItem]);

  return (
    <>
      {items.length > 0 && (
        <div className="shrink-0 border-b px-3 py-2 flex flex-col gap-1.5">
          <Button size="xs" className="w-full" onClick={handleStartLearning}>
            <IconText icon={CheckSquare} size="xs" className="gap-0">
              Start Learning ({dueCount})
            </IconText>
          </Button>
          {untranslatedCount > 0 && (
            <Button
              variant="outline"
              size="xs"
              className="w-full"
              onClick={handleBatchTranslate}
              disabled={batchTranslating}
              title="Translate all untranslated annotations"
            >
              <IconText icon={Sparkles} size="xs" className="gap-0">
                {batchTranslating ? "Translating..." : `Batch Translate (${untranslatedCount})`}
              </IconText>
            </Button>
          )}
          {v1Count > 0 && (
            <Button
              variant="outline"
              size="xs"
              className="w-full"
              onClick={handleUpgradeV1ToV2}
              disabled={upgrading}
              title="Re-translate V1 annotations with the V2 two-stage pipeline"
            >
              <IconText icon={ArrowUpCircle} size="xs" className="gap-0">
                {upgrading ? "Upgrading…" : `Upgrade to V2 (${v1Count})`}
              </IconText>
            </Button>
          )}
          <Button
            variant="outline"
            size="xs"
            className="w-full"
            onClick={() => {
              setManualText("");
              setManualDialogOpen(true);
            }}
            title="Add manual annotation"
          >
            <IconText icon={Plus} size="xs" className="gap-0">
              Add Manual Annotation
            </IconText>
          </Button>
        </div>
      )}
      {items.length > 0 && docId && (
        <div className="shrink-0 flex items-center gap-2 border-b px-3 py-1.5 text-xs">
          <span className="flex items-center gap-1 text-ctp-overlay0">
            <span className="font-medium">Source:</span>
            <select
              className="bg-transparent text-ctp-text border-b border-dotted border-ctp-overlay0/50 outline-none text-xs"
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
              {LANGUAGES_WITH_AUTO.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </span>
          <span className="flex items-center gap-1 text-ctp-overlay0">
            <span className="font-medium">Target:</span>
            <select
              className="bg-transparent text-ctp-text border-b border-dotted border-ctp-overlay0/50 outline-none text-xs"
              value={effectiveTargetLang}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__default__") return;
                if (docId) setTargetLang(docId, val);
              }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
              <option value="__default__">Default (zh)</option>
            </select>
          </span>
        </div>
      )}
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-ctp-overlay0 px-4">
          <Highlighter className="h-8 w-8 mb-2" />
          <p className="text-xs text-center">
            Highlight text in the document to add annotations
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div
            className="space-y-2 p-3"
            ref={annotationsScrollRef}
            style={{ width: 0, minWidth: "100%" }}
          >
            {[...items]
              .sort((a, b) => {
                // Manual annotations always sort to the top
                if (a.kind === "manual" && b.kind !== "manual") return -1;
                if (a.kind !== "manual" && b.kind === "manual") return 1;
                if (a.pageNumber !== b.pageNumber)
                  return a.pageNumber - b.pageNumber;
                const topA = a.embedData?.position?.boundingRect?.y1 ?? 0;
                const topB = b.embedData?.position?.boundingRect?.y1 ?? 0;
                return topA - topB;
              })
              .map((ann) => (
                <div key={ann.id} data-annotation-id={ann.id}>
                  <AITranslateCard
                    id={ann.id}
                    item={ann}
                    scrolled={false}
                    expanded={expandedCardId === ann.id}
                    collapsible
                    showFSRS={false}
                    onGoToHighlight={
                      ann.kind !== "manual"
                        ? () => pdfScrollToHighlight(ann.id)
                        : undefined
                    }
                    onToggleExpand={(id) =>
                      setExpandedCardId((prev) => (prev === id ? null : id))
                    }
                    onDelete={(id) => {
                      removeItem(id);
                    }}
                    onTranslate={async (id) => {
                      const item = items.find((i) => i.id === id);
                      if (!item || item.aiResult === null) return;

                      if (!summary || !summary.text?.trim()) {
                        showToast("Please generate a summary first", "info");
                        onTabChange?.("summary");
                        return;
                      }

                      await translateItemV2(
                        item,
                        sourceLang,
                        effectiveTargetLang,
                        summary.text,
                        texts,
                        updateItem,
                        showToast,
                      );
                    }}
                  />
                </div>
              ))}
          </div>
        </ScrollArea>
      )}

      <LearningModal
        items={sessionItems}
        studyingIndex={studyingIndex}
        answerRevealed={answerRevealed}
        setAnswerRevealed={setAnswerRevealed}
        onRate={(grade) => {
          const item = sessionItems[studyingIndex];
          if (item) {
            reviewAnnotation(item.id, grade as Grade);
          }
          if (studyingIndex + 1 < sessionItems.length) {
            setStudyingIndex((i: number) => i + 1);
            setAnswerRevealed(false);
          } else {
            showToast("All cards reviewed! Good job!", "success");
            setStudyPanelOpen(false);
            setSessionItems([]);
          }
        }}
        onClose={() => {
          setStudyPanelOpen(false);
          setSessionItems([]);
        }}
      />

      {/* Manual annotation creation dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Manual Annotation</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <textarea
              className="w-full rounded border border-ctp-overlay0/50 bg-ctp-base px-3 py-2 text-sm resize-none min-h-[80px] focus:border-ctp-mauve focus:ring-1 focus:ring-ctp-mauve outline-none"
              placeholder="Enter a word, phrase, or sentence..."
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateManual();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManualDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateManual}
              disabled={!manualText.trim()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
