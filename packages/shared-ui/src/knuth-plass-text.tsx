import { memo } from "react";

export interface KnuthPlassTextProps {
  text: string;
  className?: string;
  fontFamily?: string;
  fontSize?: number;
}

/**
 * Renders text using simple web-native line-breaking.
 * Font style props are passed in externally (not from a store).
 */
export const KnuthPlassText = memo(function KnuthPlassText({
  text,
  className = "",
  fontFamily,
  fontSize,
}: KnuthPlassTextProps) {
  if (!text) return null;

  return (
    <p
      className={className}
      style={{
        fontFamily: fontFamily ?? undefined,
        fontSize: fontSize ?? undefined,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {text}
    </p>
  );
});
