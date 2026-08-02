import type { ReactNode } from "react";
import type { AnnotationItem } from "@/stores/annotation.store";
import { AIAnnotationResultBase } from "@/components/document/AIAnnotationResult/base";
import { AIAnnotationResultUpgradeCard } from "@/components/document/AIAnnotationResult/upgrade-card";
import { AIAnnotationResultV2 } from "@/components/document/AIAnnotationResult/v2";

export interface AIAnnotationResultProps {
  item: AnnotationItem;
  showCore?: boolean;
  showDetails?: boolean;
  enableShortcut?: boolean;
  showActionBar?: boolean;
  onEditToggle?: () => void;
  editing?: boolean;
  onTranslate?: () => void | Promise<void>;
  onDelete?: () => void;
  onGoToHighlight?: () => void;
  /** Source language for TTS voice selection. */
  sourceLang?: string;
  /**
   * Slot rendered between the source text and the action bar. Used by
   * AITranslateCard to place the user-context note editor above the buttons.
   */
  contextSlot?: ReactNode;
  /**
   * When set, replaces the source text with this editor (inline text editing
   * without swapping the whole card). AITranslateCard passes its textarea here.
   */
  textEditorSlot?: ReactNode;
}

/**
 * Entry component for AI annotation rendering.
 *
 * - aiVersion === 2 → AIAnnotationResultV2 (the only current schema)
 * - aiVersion === 1 → AIAnnotationResultUpgradeCard (legacy V1 — read-only
 *   prompt offering a V2 re-translate)
 * - otherwise (undefined / null / unknown) → AIAnnotationResultBase (blank
 *   untranslated slate)
 */
export function AIAnnotationResult(props: AIAnnotationResultProps) {
  const { item } = props;

  switch (item.aiVersion) {
    case 2:
      return <AIAnnotationResultV2 {...props} />;
    case 1:
      return <AIAnnotationResultUpgradeCard {...props} />;
    default:
      return <AIAnnotationResultBase {...props} />;
  }
}
