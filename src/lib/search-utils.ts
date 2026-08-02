/**
 * Search UI helpers — pure functions shared between the search dialog and tests.
 */

/**
 * Given text and match indices, returns segments of { text, highlighted }
 * for rendering with `<mark>` tags in JSX.
 *
 * `indices` are Fuse.js match ranges `[start, end]` with an inclusive `end`.
 */
export function highlightText(
  text: string,
  indices: ReadonlyArray<readonly [number, number]> | undefined,
): Array<{ text: string; highlighted: boolean }> {
  if (!indices || indices.length === 0) return [{ text, highlighted: false }];

  const segments: Array<{ text: string; highlighted: boolean }> = [];
  let lastEnd = 0;

  for (const [start, end] of indices) {
    if (start > lastEnd) {
      segments.push({ text: text.slice(lastEnd, start), highlighted: false });
    }
    segments.push({ text: text.slice(start, end + 1), highlighted: true });
    lastEnd = end + 1;
  }

  if (lastEnd < text.length) {
    segments.push({ text: text.slice(lastEnd), highlighted: false });
  }

  return segments;
}
