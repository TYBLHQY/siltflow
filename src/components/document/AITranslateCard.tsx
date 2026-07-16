import { useState, useRef, useEffect } from "react";
import type { AnnotationItem } from "@/stores/annotation.store";
import { useAnnotationStore } from "@/stores/annotation.store";
import { hasDetails } from "@/lib/annotation-helpers";
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
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

  const handleCardClick = () => {
    if (ai) {
      onToggleExpand(id);
    }
    onClick?.();
  };

  const detailAvailable = ai ? hasDetails(ai) : false;

  return (
    <div
      className={`w-full min-w-0 rounded-lg border border-border/80 bg-white dark:bg-mantle shadow-sm p-3 transition-colors cursor-pointer ${
        scrolled ? "bg-accent/40 border-accent" : "hover:border-accent"
      } ${className}`}
      onClick={handleCardClick}
    >
      {/* ── Edit mode: header + textarea ── */}
      {editing ? (
        <textarea
          ref={inputRef}
          className="w-full rounded border bg-background px-2 py-1 resize-none min-h-[60px]"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              updateItem(id, { text: editText });
              setEditing(false);
            }
            if (e.key === "Escape") {
              setEditText(item.text);
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <AIAnnotationResult
          item={item}
          showCore
          showActionBar
          editing={editing}
          onEditToggle={() => setEditing(!editing)}
          onTranslate={() => onTranslate(id)}
          onDelete={() => onDelete(id)}
        />
      )}

      {/* ── AI details (animated) ── */}
      {ai && (
        <div className="mt-1.5">
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-in-out"
            style={{ gridTemplateRows: expanded && detailAvailable ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              {detailAvailable && (
                <AIAnnotationResult item={item} showDetails />
              )}
            </div>
          </div>

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
