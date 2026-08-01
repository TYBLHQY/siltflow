import type { AnnotationItem } from "@/stores/annotation.store";

/**
 * Z-order sorting for overlapping PDF highlights.
 *
 * The highlight library renders highlights in array order, so the LAST entry
 * in a page's array sits on TOP of the DOM layer and captures clicks over
 * overlapping highlights. To keep a small contained highlight (e.g. a word
 * inside a sentence) clickable, it must be sorted AFTER the larger highlight
 * that contains it.
 */

/**
 * Coverage area of a single highlight, computed from the position corners
 * (`x2-x1` * `y2-y1`). `ScaledPosition.boundingRect.width/height` are the
 * full-page viewport size, NOT the selection size, so we must use corners.
 * For multi-page highlights, use the largest per-page rect (the library
 * derives each page's render order from the same sorted array).
 */
export function highlightArea(item: AnnotationItem): number {
  const rects = item.embedData?.position?.rects;
  if (rects && rects.length > 0) {
    let max = 0;
    for (const r of rects) max = Math.max(max, (r.x2 - r.x1) * (r.y2 - r.y1));
    return max;
  }
  const br = item.embedData?.position?.boundingRect;
  return br ? (br.x2 - br.x1) * (br.y2 - br.y1) : 0;
}

/**
 * Sort items so smaller highlights render on top (descending area → the
 * contained item ends up at the array tail = topmost DOM layer). The library
 * renders highlights in array order and later DOM siblings sit on top, so the
 * largest (containing) highlight goes first (bottom) and the contained small
 * one last (top), where it captures clicks. Deterministic: equal-area items
 * tie-break by createdAt then id, so reloads don't flicker. The input array
 * is not mutated.
 */
export function sortItemsForZOrder(items: AnnotationItem[]): AnnotationItem[] {
  return [...items].sort((a, b) => {
    const da = highlightArea(a);
    const db = highlightArea(b);
    if (da !== db) return db - da;
    if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt)
      return a.createdAt < b.createdAt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
