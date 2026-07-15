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
import { KnuthPlassText } from "@/components/ui/knuth-plass-text";
import { useStyleStore, buildFontStack } from "@/stores/style.store";
import { useSummaryStore } from "@/stores/summary.store";
import { useDocumentStore } from "@/stores/document.store";
import { useAIStore } from "@/stores/ai.store";
import { useToastStore } from "@/stores/toast.store";
import { summarizeSelectedPages } from "@/lib/summarize";

/** Guard against stored full-JSON in the text field. */
function safeSummaryText(summary: { text: string } | undefined): string {
  if (!summary) return "";
  const t = summary.text;
  if (!t) return "";
  try {
    const parsed = JSON.parse(t);
    if (parsed && typeof parsed === "object" && parsed.summary) {
      return parsed.summary;
    }
  } catch {
    /* not JSON, use as-is */
  }
  return t;
}

export function SummaryTab() {
  const style = useStyleStore((s) => s.style);
  const showToast = useToastStore((s) => s.show);
  const activeProfile = useAIStore((s) => s.profiles.find((p) => p.active) ?? s.profiles[0] ?? null);

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
  const summaryText = safeSummaryText(summary);
  const allSelected = selPages === undefined || selPages.length === numPages;

  const [summarizing, setSummarizing] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);

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

  if (numPages === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground px-4">
        <p className="text-xs text-center">No document text available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Page selection */}
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
        </button>
        <ScrollArea className="max-h-32">
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: numPages }, (_, i) => {
              const p = i + 1;
              const selected = selPages === undefined || selPages.includes(p);
              return (
                <button
                  key={p}
                  className={`inline-flex items-center justify-center h-6 min-w-[24px] rounded px-1 text-xs font-medium transition-colors ${
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
        </button>
      </div>

      {/* Summary toolbar */}
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
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setEditingSummary(true)}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              {summary.isAiGenerated && (
                <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                  <Bot className="h-2.5 w-2.5" />
                  AI-generated
                </span>
              )}
              <button
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
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
              value={summaryText}
              onChange={(e) => handleEditSummary(e.target.value)}
              autoFocus
            />
          ) : (
            <div className="h-full overflow-y-auto px-3 py-3">
              <KnuthPlassText
                text={summaryText}
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
  );
}
