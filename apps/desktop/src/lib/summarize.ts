/**
 * Desktop-specific PDF text extraction via pdfjs-dist.
 * Note: summarizeSelectedPages is in @siltflow/shared/ai.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

export async function extractPageTexts(
  pdfDoc: PDFDocumentProxy,
): Promise<string[]> {
  const numPages = pdfDoc.numPages;
  const texts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    texts.push(text);
  }

  return texts;
}
