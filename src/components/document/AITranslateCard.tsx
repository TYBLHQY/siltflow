import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Plus } from "lucide-react";
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
  // User-authored context note editor (independent from the text editor).
  const [editingContext, setEditingContext] = useState(false);
  const [editContext, setEditContext] = useState(item.context ?? "");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contextInputRef = useRef<HTMLTextAreaElement>(null);
  const updateItem = useAnnotationStore((s) => s.updateItem);

  useEffect(() => {
    setEditText(item.text);
  }, [item.text]);

  useEffect(() => {
    setEditContext(item.context ?? "");
  }, [item.context]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Auto-focus the context note editor when it opens.
  useEffect(() => {
    if (editingContext && contextInputRef.current) {
      contextInputRef.current.focus();
    }
  }, [editingContext]);

  // Save an edited text. V2 cards render `ai.input.normalized` (not item.text),
  // so a bare `{ text }` update wouldn't show up — sync normalized too so the
  // edit is visible and survives a reload. Untranslated (undefined) cards have
  // no aiResult, so a bare `{ text }` update is what persists. V1 cards are
  // read-only: the edit toggle is gated to aiVersion !== 1, so this only ever
  // runs for V2 or untranslated cards.
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
    } else if (item.aiVersion !== 1) {
      // Untranslated card — no aiResult to sync; a bare text update keeps the
      // card in its blank-slate state.
      updateItem(id, { text: nextText });
      setEditing(false);
    }
  }, [editText, id, item.aiVersion, item.aiResult, updateItem]);

  const handleCardClick = () => {
    if (ai && isV2) {
      onToggleExpand(id);
    }
    onClick?.();
  };

  // ── Context note handlers ──────────────────────────────────────────────
  // Editing context only persists the note (no aiResult / aiVersion change,
  // no auto re-translate). The new note takes effect on the next manual
  // translate. Gate: V2 or untranslated cards with an action bar; V1 cards
  // (read-only) and the search panel (no callbacks) are excluded.
  const contextEditAllowed =
    item.aiVersion !== 1 && !!(onDelete || onTranslate);

  const handleSaveContext = useCallback(() => {
    const next = editContext.trim();
    updateItem(id, { context: next ? next : undefined });
    setEditingContext(false);
  }, [editContext, id, updateItem]);

  // V2 uses its own type-based layout; V1 cards render through UpgradeCard and
  // have no details, so there is no legacy detail-availability gate.
  const isV2 = item.aiVersion === 2;

  // Action bar: only expose edit when at least one of delete/translate is
  // provided (i.e., the caller wants a full-featured bar, not just TTS+Goto),
  // AND the card is editable — V1 cards are read-only (no pencil); both V2
  // and untranslated (undefined/null version) cards get one.
  const actionBarProps: {
    editing: boolean;
    onEditToggle?: () => void;
    onTranslate?: () => void | Promise<void>;
    onDelete?: () => void;
    onGoToHighlight?: () => void;
  } = {
    editing,
    ...(item.aiVersion !== 1 && (onDelete || onTranslate)
      ? { onEditToggle: () => setEditing(!editing) }
      : {}),
    ...(onTranslate ? { onTranslate: () => onTranslate(id) } : {}),
    ...(onDelete ? { onDelete: () => onDelete(id) } : {}),
    ...(onGoToHighlight ? { onGoToHighlight } : {}),
  };

  // ── Context note editor block ─────────────────────────────────────────
  // Injected as `contextSlot` into AIAnnotationResult so it renders between
  // the source text and the action bar (i.e. ABOVE the buttons), in both
  // collapsible and non-collapsible layouts. Hidden while the text editor is
  // active. Read-only display lives in AIAnnotationResult v2 details; this
  // block is the edit affordance.
  const contextNoteEditor = (
    // -mt-1 cancels the parent showCore block's space-y-1 so the note hugs
    // the source text; edit mode keeps its own textarea chrome. Only the
    // interactive children stop propagation — the row's empty area still
    // toggles expand/collapse.
    <div className="-mt-1">
      {editingContext ? (
        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
          <textarea
            ref={contextInputRef}
            className="w-full rounded border bg-ctp-base px-2 py-1 resize-none min-h-16 text-xs whitespace-pre-wrap wrap-break-word"
            value={editContext}
            onChange={(e) => setEditContext(e.target.value)}
            onKeyDown={(e) => {
              // Enter (no shift) saves, Shift+Enter inserts a newline,
              // Escape cancels — same keyboard contract as the text editor.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSaveContext();
              }
              if (e.key === "Escape") {
                setEditContext(item.context ?? "");
                setEditingContext(false);
              }
            }}
            placeholder="Add a context note to guide translation…"
          />
        </div>
      ) : (
        <button
          className="inline-flex items-center rounded p-0.5 align-baseline cursor-pointer text-[11px] text-ctp-overlay1 hover:text-ctp-text"
          onClick={(e) => {
            e.stopPropagation();
            setEditingContext(true);
          }}
          title={
            item.context?.trim()
              ? "Edit context note"
              : "Add a context note to guide translation"
          }
        >
          {item.context?.trim() ? (
            <>
              <Pencil className="h-3 w-3 mr-2" />
              <span className="max-w-60 truncate">{item.context}</span>
            </>
          ) : (
            <>
              <Plus className="h-3 w-3 mr-2" />
              Add context
            </>
          )}
        </button>
      )}
    </div>
  );

  // ── Collapsible mode (annotations panel cards) ──
  if (collapsible) {
    return (
      <div
        className={`w-full min-w-0 rounded-lg border border-ctp-overlay0/80 bg-card shadow-sm p-3 transition-colors ${
          scrolled ? "bg-ctp-surface0/40 border-accent" : "hover:border-accent"
        } ${className}`}
      >
        {/* ── Card core: header + source text + context + action bar ──
            Clicking the core toggles expand (skipped while text-editing;
            interactive children stopPropagation). */}
        <div
          onClick={() => {
            if (editing) return;
            if (ai && isV2) onToggleExpand(id);
          }}
        >
          <AIAnnotationResult
            item={item}
            showCore
            showActionBar={showActionBar}
            sourceLang={sourceLang}
            contextSlot={contextEditAllowed ? contextNoteEditor : undefined}
            textEditorSlot={
              editing ? (
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
              ) : undefined
            }
            {...actionBarProps}
          />
        </div>

        {/* ── Collapsible details (animated, V2 only) ── */}
        {ai && isV2 && (
          <div>
            {/* V2 details */}
            <div
              data-collapsible-grid
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
      className={`w-full min-w-0 rounded-lg border border-ctp-overlay0/80 bg-card shadow-sm p-3 transition-colors ${
        scrolled ? "bg-ctp-surface0/40 border-accent" : "hover:border-accent"
      } ${className}`}
      onClick={handleCardClick}
    >
      {/* ── Card core: header + source text + context + action bar ── */}
      <AIAnnotationResult
        item={item}
        showCore
        showActionBar={showActionBar}
        sourceLang={sourceLang}
        contextSlot={contextEditAllowed ? contextNoteEditor : undefined}
        textEditorSlot={
          editing ? (
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
          ) : undefined
        }
        {...actionBarProps}
      />

      {/* ── AI details (V2; V1 cards have none) ── */}
      {ai && isV2 && (
        <div className="mt-1.5">
          {/* V2 details — always shown in non-collapsible mode */}
          <AIAnnotationResult item={item} showDetails sourceLang={sourceLang} />

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
