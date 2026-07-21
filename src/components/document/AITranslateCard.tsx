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
  onTranslate: (id: string) => Promise<void>;
  onClick?: () => void;
  scrolled?: boolean;
  className?: string;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  /** Goto highlight callback — shows ExternalLink button in V2 action bar. */
  onGoToHighlight?: () => void;
  /**
   * When true: upper area click toggles expand, details animate via CSS grid
   * transition, default collapsed. Card-level onClick is suppressed.
   */
  collapsible?: boolean;
  /** Show FSRS stats at the bottom of the card. Defaults to true. */
  showFSRS?: boolean;
  /** Show action bar (edit / translate / delete / go to highlight). Defaults to true. */
  showActionBar?: boolean;
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
  onGoToHighlight,
  collapsible = false,
  showFSRS = true,
  showActionBar = true,
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

  // hasDetails only applies to V1 data; V2 uses its own type-based layout
  const detailAvailable = ai && "translation" in ai ? hasDetails(ai) : false;
  const isV2 = item.aiVersion === 2;

  const actionBarProps = {
    editing,
    onEditToggle: () => setEditing(!editing),
    onTranslate: () => onTranslate(id),
    onDelete: () => onDelete(id),
    onGoToHighlight,
  };

  // ── Collapsible mode (annotations panel cards) ──
  if (collapsible) {
    return (
      <div
        className={`w-full min-w-0 rounded-lg border border-ctp-overlay0/80 bg-card shadow-sm p-3 transition-colors ${
          scrolled ? "bg-ctp-surface0/40 border-accent" : "hover:border-accent"
        } ${className}`}
      >
        {/* ── Edit mode: full-card textarea ── */}
        {editing ? (
          <textarea
            ref={inputRef}
            className="w-full rounded border bg-ctp-base px-2 py-1 resize-none min-h-15"
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
          /* ── Upper area: clickable to toggle expand ── */
          <div
            onClick={() => { if (ai) onToggleExpand(id); }}
            className="cursor-pointer"
          >
            <AIAnnotationResult
              item={item}
              showCore
              showActionBar={showActionBar}
              {...actionBarProps}
            />
          </div>
        )}

        {/* ── Collapsible details (animated) ── */}
        {ai && (
          <div>
            {/* V1 details */}
            {detailAvailable && (
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                style={{
                  gridTemplateRows: expanded ? "1fr" : "0fr",
                }}
              >
                <div className="overflow-hidden">
                  <AIAnnotationResult item={item} showDetails />
                </div>
              </div>
            )}

            {/* V2 details */}
            {isV2 && (
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                style={{
                  gridTemplateRows: expanded ? "1fr" : "0fr",
                }}
              >
                <div className="overflow-hidden">
                  <AIAnnotationResult item={item} showDetails />
                </div>
              </div>
            )}

            {showFSRS && item.fsrsCard && (
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

  // ── Non-collapsible (legacy V1 / other uses) ──
  return (
    <div
      className={`w-full min-w-0 rounded-lg border border-ctp-overlay0/80 bg-card shadow-sm p-3 transition-colors cursor-pointer ${
        scrolled ? "bg-ctp-surface0/40 border-accent" : "hover:border-accent"
      } ${className}`}
      onClick={handleCardClick}
    >
      {/* ── Edit mode: header + textarea ── */}
      {editing ? (
        <textarea
          ref={inputRef}
          className="w-full rounded border bg-ctp-base px-2 py-1 resize-none min-h-15"
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
          showActionBar={showActionBar}
          {...actionBarProps}
        />
      )}

      {/* ── AI details (animated for V1, static for V2) ── */}
      {ai && (
        <div className="mt-1.5">
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-in-out"
            style={{
              gridTemplateRows: expanded && detailAvailable ? "1fr" : "0fr",
            }}
          >
            <div className="overflow-hidden">
              {detailAvailable && (
                <AIAnnotationResult item={item} showDetails />
              )}
            </div>
          </div>

          {/* V2 details — always shown in non-collapsible mode */}
          {isV2 && <AIAnnotationResult item={item} showDetails />}

          {showFSRS && item.fsrsCard && (
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
