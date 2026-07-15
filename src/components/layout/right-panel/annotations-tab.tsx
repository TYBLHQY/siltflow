import {
  Highlighter,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconText } from "@/components/ui/icon-text";
import { AITranslateCard } from "@/components/document/AITranslateCard";
import { LearningModal } from "@/components/document/LearningModal";
import { useAnnotationStore } from "@/stores/annotation.store";
import { useSummaryStore } from "@/stores/summary.store";
import { useDocumentStore } from "@/stores/document.store";
import { useAIStore } from "@/stores/ai.store";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import { useToastStore } from "@/stores/toast.store";
import { useShortcut } from "@/hooks/useShortcut";
import { reviewAnnotation } from "@/stores/fsrs.store";
import type { Grade } from "ts-fsrs";

interface AnnotationsTabProps {
  onTabChange?: (tab: string) => void;
  annotationsScrollRef: React.RefObject<HTMLDivElement>;
}

export function AnnotationsTab({
  onTabChange,
  annotationsScrollRef,
}: AnnotationsTabProps) {
  // ── Store reads ────────────────────────────────────────────────────
  const items = useAnnotationStore((s) => s.items);
  const updateItem = useAnnotationStore((s) => s.updateItem);
  const removeItem = useAnnotationStore((s) => s.removeItem);
  const showToast = useToastStore((s) => s.show);
  const profiles = useAIStore((s) => s.profiles);
  const defaultTargetLang = useAIStore((s) => s.defaultTargetLang);
  const summaries = useSummaryStore((s) => s.summaries);
  const pageTexts = useSummaryStore((s) => s.pageTexts);
  const targetLangs = useSummaryStore((s) => s.targetLangs);
  const setTargetLang = useSummaryStore((s) => s.setTargetLang);
  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const scrollToHighlight = usePdfViewerStore((s) => s.scrollToHighlight) ?? undefined;

  const docId = currentDocument?.id;
  const summary = docId ? summaries[docId] : undefined;
  const texts = docId ? pageTexts[docId] : undefined;
  const activeProfile = profiles.find((p) => p.active) ?? profiles[0] ?? null;
  const sourceLang = summary?.sourceLang ?? "en";
  const effectiveTargetLang =
    (docId && targetLangs[docId]) || defaultTargetLang || "zh";

  // ── Local state ────────────────────────────────────────────────────
  const [studyPanelOpen, setStudyPanelOpen] = useState(false);
  const [studyingIndex, setStudyingIndex] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [batchTranslating, setBatchTranslating] = useState(false);

  // ── Start Learning shortcut ────────────────────────────────────────
  const hasPdf = !!currentDocument?.id;
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

  useShortcut("startLearning", handleStartLearning, { enabled: hasPdf && !studyPanelOpen });

  // ── Batch translate ────────────────────────────────────────────────
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

  return (
    <>
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
                Default (zh)
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
            ref={annotationsScrollRef}
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
                <div key={ann.id} data-annotation-id={ann.id}>
                  <AITranslateCard
                    id={ann.id}
                    item={ann}
                    scrolled={false}
                    expanded={expandedCardId === ann.id}
                    onToggleExpand={(id) =>
                      setExpandedCardId((prev) => (prev === id ? null : id))
                    }
                    onClick={() => scrollToHighlight?.(ann.id)}
                    onDelete={(id) => {
                      removeItem(id);
                    }}
                    onTranslate={async (id) => {
                      const item = items.find((i) => i.id === id);
                      if (!item || item.aiResult === null) return;

                      const profile = activeProfile;
                      if (!profile) {
                        showToast(
                          "Please configure an AI provider in Settings > AI Config",
                          "info",
                        );
                        return;
                      }

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
                </div>
              ))}
          </div>
        </ScrollArea>
      )}

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
            setStudyingIndex((i: number) => i + 1);
            setAnswerRevealed(false);
          } else {
            showToast("All cards reviewed! Good job!", "success");
            setStudyPanelOpen(false);
          }
        }}
        onClose={() => setStudyPanelOpen(false)}
      />
    </>
  );
}
