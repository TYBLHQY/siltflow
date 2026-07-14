/**
 * Split text into chunks no larger than `maxBytes` bytes (UTF-8).
 *
 * Ported from Python edge-tts split_text_by_byte_length().
 * Splits at natural boundaries:
 *   1. Newline (\n)
 *   2. Space
 *   3. UTF-8 multi-byte safe boundary
 *   4. XML entity boundary (no split inside &...;)
 */
export function splitTextByByteLength(
  text: string,
  maxBytes: number,
): string[] {
  if (!text) return [""];

  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);

  if (encoded.length <= maxBytes) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    // Binary search for the split point within maxBytes
    let lo = start + 1;
    let hi = text.length;
    let bestSplit = start;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const slice = text.slice(start, mid);
      if (encoder.encode(slice).length <= maxBytes) {
        bestSplit = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    // Backtrack to find a clean boundary
    const segment = text.slice(start, bestSplit);
    let splitAt = bestSplit;

    // 1. Prefer newline
    const lastNewline = segment.lastIndexOf("\n");
    if (lastNewline >= 0) {
      splitAt = start + lastNewline + 1;
    } else {
      // 2. Fall back to space
      const lastSpace = segment.lastIndexOf(" ");
      if (lastSpace >= 0 && lastSpace > segment.length * 0.5) {
        splitAt = start + lastSpace + 1;
      }
      // 3. Otherwise just split at byte boundary (already UTF-8 safe since
      //    we're slicing JS strings by character index)
    }

    // 4. Ensure we don't split inside an XML entity
    const beforeSplit = text.slice(start, splitAt);
    const ampIdx = beforeSplit.lastIndexOf("&");
    const semiIdx = beforeSplit.lastIndexOf(";");
    if (ampIdx >= 0 && (semiIdx < 0 || semiIdx < ampIdx)) {
      // We're inside an XML entity — backtrack past the &
      splitAt = start + ampIdx;
    }

    // If backtracking left us with nothing, force split at bestSplit
    if (splitAt <= start) {
      splitAt = bestSplit;
    }

    chunks.push(text.slice(start, splitAt));
    start = splitAt;
  }

  return chunks;
}
