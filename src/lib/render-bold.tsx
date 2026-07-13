import type { ReactNode } from "react";

/**
 * Renders inline **bold** markers as highlighted spans.
 * Splits text around `**...**` patterns so bold segments are wrapped in
 * a visual highlight span without using dangerouslySetInnerHTML.
 */
export function renderBoldText(
  text: string,
  options?: {
    boldClassName?: string;
  },
): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <span
          key={i}
          className={options?.boldClassName ?? "font-bold"}
        >
          {m[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
