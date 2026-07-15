import {
  Highlighter,
  Trash2,
  Sparkles,
  Loader2,
  Volume2,
  Pencil,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { AnnotationItem } from "@/stores/annotation.store";
import { IconText } from "@/components/ui/icon-text";
import { KnuthPlassText } from "@/components/ui/knuth-plass-text";
import { useTTS } from "@/hooks/useTts";
import { useAnnotationStore } from "@/stores/annotation.store";
import { inferGranularity, hasDetails } from "@/lib/annotation-helpers";
import { AIAnnotationResult } from "@/components/document/AIAnnotationResult";
import { FSRSStats } from "@/components/document/FSRSStats";

interface AITranslateCardProps {
  id: string;
  item: AnnotationItem;
  onDelete: (id: string) => void;
  onTranslate: (id: string) => void;
  onClick?: () => void;
  scrolled?: boolean;
  className?: string;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────

export function AITranslateCard({
  id,
  item,
  onDelete,
  onTranslate,
  onClick,
  scrolled,
  className = "",
  expanded,
  onToggleExpand,
}: AITranslateCardProps) {
  const ai = item.aiResult;
  const aiVersion = item.aiVersion ?? undefined;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tts = useTTS();
  const updateItem = useAnnotationStore((s) => s.updateItem);

  useEffect(() => {
    setEditText(item.text);
  }, [item.text]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(id);
  };

  const handleEditToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editing) {
      updateItem(id, { text: editText });
    }
    setEditing(!editing);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      updateItem(id, { text: editText });
      setEditing(false);
    }
    if (e.key === "Escape") {
      setEditText(item.text);
      setEditing(false);
    }
  };

  const handleCardClick = () => {
    if (ai) {
      onToggleExpand(id);
    }
    onClick?.();
  };

  const granularity = ai ? inferGranularity(ai, item.text) : "highlight";
  const detailAvailable = ai ? hasDetails(ai) : false;

  return (
    <div
      className={`w-full min-w-0 rounded-lg border border-border/80 bg-white dark:bg-mantle shadow-sm p-3 transition-colors cursor-pointer ${
        scrolled ? "bg-accent/40 border-accent" : "hover:border-accent"
      } ${className}`}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <IconText icon={Highlighter} size="xs">
            <span className="font-medium text-muted-foreground uppercase tracking-wider">
              {granularity}
            </span>
          </IconText>
          <span className="text-muted-foreground">p.{item.pageNumber}</span>
        </div>
      </div>

      {/* Source text — editable */}
      {editing ? (
        <textarea
          ref={inputRef}
          className="w-full rounded border bg-background px-2 py-1 resize-none min-h-[60px]"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <KnuthPlassText text={item.text} className="mb-1" />
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-1 mt-1.5">
        <button
          className={`inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 transition-colors ${
            editing ? "text-primary" : "text-maroon hover:bg-accent"
          }`}
          onClick={handleEditToggle}
          title={editing ? "Save" : "Edit"}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        <button
          className={`inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 transition-colors ${
            tts.state === "playing"
              ? "text-primary"
              : "text-maroon hover:bg-accent"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (tts.state === "playing") tts.stop();
            else tts.speak(item.text, undefined, item.aiResult?.source_lang);
          }}
          title={tts.state === "playing" ? "Stop" : "Read aloud"}
        >
          {tts.state === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </button>

        {ai === undefined && (
          <button
            className="inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 text-maroon hover:bg-accent transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onTranslate(id);
            }}
            title="Translate"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        )}

        {ai === null && (
          <span className="inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 text-maroon/60">
            <Loader2 className="h-3 w-3 animate-spin" />
          </span>
        )}

        {ai !== undefined && ai !== null && (
          <button
            className="inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 text-maroon hover:bg-accent transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onTranslate(id);
            }}
            title="Re-translate"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          className="ml-auto inline-flex items-center justify-center rounded border border-border/50 bg-muted/40 p-1 text-maroon hover:bg-accent hover:text-destructive transition-colors"
          onClick={handleDelete}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* AI result */}
      {ai && (
        <div className="mt-1.5">
          {/* Core: translation + meta tags + definitions (always shown) */}
          <AIAnnotationResult item={item} version={aiVersion} showCore />

          {/* Details: examples + collocations + alternatives (animated) */}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-in-out"
            style={{ gridTemplateRows: expanded && detailAvailable ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              {detailAvailable && (
                <AIAnnotationResult item={item} version={aiVersion} showDetails />
              )}
            </div>
          </div>

          {/* FSRS card stats (compact) */}
          {item.fsrsCard && (
            <FSRSStats
              card={item.fsrsCard}
              annotationId={item.id}
              documentId={item.documentId}
            />
          )}
        </div>
      )}
    </div>
  );
}
