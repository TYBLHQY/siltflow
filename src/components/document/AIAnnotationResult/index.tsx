import type { AnnotationItem } from "@/stores/annotation.store";
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
}

/**
 * Entry component for AI annotation rendering.
 *
 * Dispatches to the correct version renderer based on `item.aiVersion`.
 * - undefined / 1 → AIAnnotationResultV1
 * - 2 → AIAnnotationResultV2
 */
export function AIAnnotationResult(props: AIAnnotationResultProps) {
  const { item } = props;
  const version = item.aiVersion ?? 1;

  switch (version) {
    case 2:
      return <AIAnnotationResultV2 {...props} />;
    case 1:
      return <AIAnnotationResultV1 {...props} />;
    default:
      return <AIAnnotationResultV1 {...props} />;
  }
}
