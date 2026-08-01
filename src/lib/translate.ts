/**
 * ====================================================================
 * Article context extraction
 * ====================================================================
 *
 * The V1 translate pipeline (translateAnnotation) has been removed from the
 * codebase — all translation goes through the V2 two-stage pipeline in
 * translate-v2.ts. What remains here is the shared article-context digest
 * helper, used by the V2 pipeline as translation background context.
 */

/**
 * Extract a lightweight digest from a large PDF text chunk for use as
 * translation background context.
 */
export function extractArticleContext(pdfText: string): string {
  const lines = pdfText.split("\n");
  const result: string[] = [];
  let remaining = 3000;

  // 1. First block (up to 2000 chars)
  const firstBlock = pdfText.slice(0, 2000).replace(/\s+/g, " ").trim();
  result.push(firstBlock);
  remaining -= firstBlock.length;

  if (remaining <= 0) return result.join("\n\n");

  // 2 & 3. Scan for heading-like lines and grab the first sentence after each
  const headingRe =
    /^#{1,3}\s|^(?:Abstract|Introduction|Background|Method|Result|Discussion|Conclusion|References)\b/i;

  for (let i = 0; i < lines.length && remaining > 0; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (headingRe.test(line)) {
      result.push(line);
      remaining -= line.length;

      let sentence = "";
      const j = i + 1;
      if (j < Math.min(lines.length, i + 5)) {
        const next = lines[j].trim();
        if (next) {
          sentence = next;
        }
      }
      if (sentence) {
        const snippet =
          sentence.length > 500 ? `${sentence.slice(0, 500)}…` : sentence;
        result.push(snippet);
        remaining -= snippet.length;
      }
    }
  }

  return result.join("\n\n").replace(/\s+/g, " ").trim();
}
