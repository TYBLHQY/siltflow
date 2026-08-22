import type { AnnotationItem } from "@/stores/annotation.store";

/**
 * Render one annotation as a single plain-text block for the "copy list as
 * text" action. Keeps the source text, its translation (V2 output), the
 * user context note, and the page — enough to be useful outside the app
 * without any structure.
 *
 * Pure and side-effect free; the clipboard write lives in the component that
 * calls it, so this formatting logic stays unit-testable.
 */
export function annotationToPlainText(item: AnnotationItem): string {
  const page = item.pageNumber > 0 ? `p.${item.pageNumber}` : "—";
  const kind =
    item.kind === "manual" ? "manual" : (item.aiResult?.input.type ?? "note");
  const lines: string[] = [`${page}  [${kind}]`, item.text];

  const out = item.aiResult?.output;
  if (out) {
    if ("meanings" in out) {
      lines.push(`→ ${out.meanings.map((m) => m.translation).join("；")}`);
    } else if ("translation" in out) {
      lines.push(`→ ${out.translation}`);
    }
  }
  if (item.context) lines.push(`note: ${item.context}`);
  return lines.join("\n");
}
