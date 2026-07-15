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
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconText } from "@/components/ui/icon-text";
import { KnuthPlassText } from "@/components/ui/knuth-plass-text";
import { useStyleStore, buildFontStack } from "@/stores/style.store";

interface SummaryTabProps {
  docId: string | undefined;
  numPages: number;
  selPages: number[] | undefined;
  allSelected: boolean;
  togglePage: (pageNum: number) => void;
  toggleAll: () => void;
  summarizing: boolean;
  handleSummarize: () => void;
  editingSummary: boolean;
  setEditingSummary: (v: boolean) => void;
  summary: any;
  handleEditSummary: (text: string) => void;
  handleClearSummary: () => void;
}

export function SummaryTab({
  docId,
  numPages,
  selPages,
  allSelected,
  togglePage,
  toggleAll,
  summarizing,
  handleSummarize,
  editingSummary,
  setEditingSummary,
  summary,
  handleEditSummary,
  handleClearSummary,
}: SummaryTabProps) {
  const style = useStyleStore((s) => s.style);

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
  );
}
