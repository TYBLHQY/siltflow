import type { AnnotationItem } from "@/stores/annotation.store";
import { AIAnnotationResultBase } from "@/components/document/AIAnnotationResult/base";
import { AIAnnotationResultV1 } from "@/components/document/AIAnnotationResult/v1";
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
}

/**
 * Entry component for AI annotation rendering.
 *
 * - No aiVersion (untranslated) → AIAnnotationResultBase (blank slate)
 * - aiVersion === 1 → AIAnnotationResultV1
 * - aiVersion === 2 → AIAnnotationResultV2
 */
export function AIAnnotationResult(props: AIAnnotationResultProps) {
  const { item } = props;

  if (!item.aiVersion) return <AIAnnotationResultBase {...props} />;

  switch (item.aiVersion) {
    case 2:
      return <AIAnnotationResultV2 {...props} />;
    case 1:
    default:
      return <AIAnnotationResultV1 {...props} />;
  }
}
