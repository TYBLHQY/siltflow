import { Button } from "@/components/ui/button";
import {
  CheckSquare,
  Square,
  Sparkles,
  Loader2,
  FileText,
  Pencil,
  Bot,
  Trash2,
} from "lucide-react";
import { useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconText } from "@/components/ui/icon-text";

import { useStyleStore, buildFontStack } from "@/stores/style.store";
import { useSummaryStore } from "@/stores/summary.store";
import { useDocumentStore } from "@/stores/document.store";
import { useAIStore } from "@/stores/ai.store";
import { useToastStore } from "@/stores/toast.store";
import { summarizeSelectedPages } from "@/lib/summarize";

export function SummaryTab() {
  const style = useStyleStore((s) => s.style);
  const showToast = useToastStore((s) => s.show);
  const activeProfile = useAIStore(
    (s) => s.getProfileForTask("summarize"),
  );

  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const summaries = useSummaryStore((s) => s.summaries);
  const pageTexts = useSummaryStore((s) => s.pageTexts);
  const selectedPages = useSummaryStore((s) => s.selectedPages);
  const setSummary = useSummaryStore((s) => s.setSummary);
  const clearSummary = useSummaryStore((s) => s.clearSummary);
  const setSelectedPages = useSummaryStore((s) => s.setSelectedPages);

  const docId = currentDocument?.id;
  const texts = docId ? pageTexts[docId] : undefined;
  const numPages = currentDocument?.totalPages ?? texts?.length ?? 0;
  const selPages = docId ? selectedPages[docId] : undefined;
  const summary = docId ? summaries[docId] : undefined;
  const allSelected = selPages === undefined || selPages.length === numPages;

  const [summarizing, setSummarizing] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);

  const togglePage = useCallback(
    (pageNum: number) => {
      if (!docId || !numPages) return;
      const current =
        selPages ?? Array.from({ length: numPages }, (_, i) => i + 1);
      if (current.includes(pageNum) && current.length === 1) return;
      const next = current.includes(pageNum)
        ? current.filter((p) => p !== pageNum)
        : [...current, pageNum].sort((a, b) => a - b);
      setSelectedPages(
        docId,
        next.length === numPages
          ? Array.from({ length: numPages }, (_, i) => i + 1)
          : next,
      );
    },
    [docId, numPages, selPages, setSelectedPages],
  );

  const toggleAll = useCallback(() => {
    if (!docId || !numPages) return;
    if (allSelected) setSelectedPages(docId, []);
    else
      setSelectedPages(
        docId,
        Array.from({ length: numPages }, (_, i) => i + 1),
      );
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

  if (numPages === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-ctp-overlay0 px-4">
        <p className="text-xs text-center">No document text available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Page selection */}
      <div className="border-b px-3 py-2 space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start gap-1.5 text-xs font-medium px-0"
          onClick={toggleAll}
        >
          {allSelected ? (
            <CheckSquare className="h-3.5 w-3.5 text-ctp-mauve shrink-0" />
          ) : (
            <Square className="h-3.5 w-3.5 shrink-0" />
          )}
          {numPages} pages
        </Button>
        <ScrollArea className="max-h-32">
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: numPages }, (_, i) => {
              const p = i + 1;
              const selected = selPages === undefined || selPages.includes(p);
              return (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className={`h-6 min-w-6 px-1 text-xs font-medium ${
                    selected
                      ? "bg-ctp-mauve/10 text-ctp-mauve"
                      : "text-ctp-overlay0"
                  }`}
                  onClick={() => togglePage(p)}
                >
                  {p}
                </Button>
              );
            })}
          </div>
        </ScrollArea>

        <Button
          size="xs"
          className="w-full justify-center"
          onClick={handleSummarize}
          disabled={summarizing}
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
        </Button>
      </div>

      {/* Summary toolbar */}
      {summary && (
        <div className="flex items-center gap-2 border-b px-3 py-1.5 shrink-0">
          {editingSummary ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingSummary(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => setEditingSummary(false)}>
                Save
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingSummary(true)}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              {summary.isAiGenerated && (
                <span className="text-xs text-ctp-overlay0/60 flex items-center gap-1">
                  <Bot className="h-2.5 w-2.5" />
                  AI-generated
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto hover:text-ctp-red"
                onClick={handleClearSummary}
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            </>
          )}
        </div>
      )}

      {/* Summary content */}
      <div className="flex-1 min-h-0">
        {summary ? (
          editingSummary ? (
            <textarea
              className="h-full w-full resize-none border-0 bg-ctp-base p-3 leading-relaxed"
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
              <p className="text-xs text-ctp-text whitespace-pre-wrap wrap-break-word leading-relaxed rounded-md border border-ctp-overlay0/20 px-2 py-1.5">
                {summary.text}
              </p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-ctp-overlay0 px-4 gap-1">
            <FileText className="h-8 w-8 mb-1" />
            <p className="text-xs text-center">
              Select pages above and click AI Summarize
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
