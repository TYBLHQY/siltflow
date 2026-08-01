import { useState, useRef, useEffect, useCallback } from "react";
import {
  useAnnotationStore,
  type AnnotationItem,
} from "@/stores/annotation.store";
import { AIAnnotationResult } from "@/components/document/AIAnnotationResult";
import { FSRSStats } from "@/components/document/FSRSStats";

interface AITranslateCardProps {
  id: string;
  item: AnnotationItem;
  onDelete?: (id: string) => void;
  onTranslate?: (id: string) => Promise<void>;
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
  /** Source language for TTS voice selection and listenCardAudio shortcut. */
  sourceLang?: string;
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
  sourceLang,
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

  // Save an edited text. V2 cards render `ai.input.normalized` (not item.text),
  // so a bare `{ text }` update wouldn't show up — sync normalized too so the
  // edit is visible and survives a reload. Editing only ever runs for V2 cards:
  // V1 cards are read-only and the edit toggle is gated to aiVersion === 2.
  const handleSaveText = useCallback(() => {
    const nextText = editText;
    if (item.aiVersion === 2) {
      const ai = item.aiResult;
      if (ai && "input" in ai) {
        updateItem(id, {
          text: nextText,
          aiResult: { ...ai, input: { ...ai.input, normalized: nextText } },
        });
      } else {
        updateItem(id, { text: nextText });
      }
      setEditing(false);
    }
  }, [editText, id, item.aiVersion, item.aiResult, updateItem]);

  const handleCardClick = () => {
    if (ai && isV2) {
      onToggleExpand(id);
    }
    onClick?.();
  };

  // V2 uses its own type-based layout; V1 cards render through UpgradeCard and
  // have no details, so there is no legacy detail-availability gate.
  const isV2 = item.aiVersion === 2;

  // Action bar: only expose edit when at least one of delete/translate is
  // provided (i.e., the caller wants a full-featured bar, not just TTS+Goto),
  // AND the card is V2 — V1 cards are read-only (no pencil).
  const actionBarProps: {
    editing: boolean;
    onEditToggle?: () => void;
    onTranslate?: () => void | Promise<void>;
    onDelete?: () => void;
    onGoToHighlight?: () => void;
  } = {
    editing,
    ...(item.aiVersion === 2 && (onDelete || onTranslate)
      ? { onEditToggle: () => setEditing(!editing) }
      : {}),
    ...(onTranslate ? { onTranslate: () => onTranslate(id) } : {}),
    ...(onDelete ? { onDelete: () => onDelete(id) } : {}),
    ...(onGoToHighlight ? { onGoToHighlight } : {}),
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
                handleSaveText();
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
            onClick={() => {
              if (ai && isV2) onToggleExpand(id);
            }}
            className="cursor-pointer"
          >
            <AIAnnotationResult
              item={item}
              showCore
              showActionBar={showActionBar}
              sourceLang={sourceLang}
              {...actionBarProps}
            />
          </div>
        )}

        {/* ── Collapsible details (animated, V2 only) ── */}
        {ai && isV2 && (
          <div>
            {/* V2 details */}
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-in-out"
              style={{
                gridTemplateRows: expanded ? "1fr" : "0fr",
              }}
            >
              <div className="overflow-hidden">
                <AIAnnotationResult
                  item={item}
                  showDetails
                  sourceLang={sourceLang}
                />
              </div>
            </div>

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

  // ── Non-collapsible (expanded detail card, e.g. search panel) ──
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
              handleSaveText();
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
          sourceLang={sourceLang}
          {...actionBarProps}
        />
      )}

      {/* ── AI details (V2; V1 cards have none) ── */}
      {ai && isV2 && (
        <div className="mt-1.5">
          {/* V2 details — always shown in non-collapsible mode */}
          <AIAnnotationResult
            item={item}
            showDetails
            sourceLang={sourceLang}
          />

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
