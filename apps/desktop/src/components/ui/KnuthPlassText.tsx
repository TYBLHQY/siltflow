import { KnuthPlassText as SharedKnuthPlassText } from "@siltflow/shared-ui";
import { memo } from "react";
import { useStyleStore, buildFontStack } from "@/stores/style.store";

export interface KnuthPlassTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with font styles from the app's style store.
 * Delegates to @siltflow/shared-ui for the rendering.
 */
export const KnuthPlassText = memo(function KnuthPlassText({
  text,
  className = "",
}: KnuthPlassTextProps) {
  const style = useStyleStore((s) => s.style);

  if (!text) return null;

  return (
    <SharedKnuthPlassText
      text={text}
      className={className}
      fontFamily={buildFontStack(style.fontFamilies)}
      fontSize={style.fontSize}
    />
  );
});
