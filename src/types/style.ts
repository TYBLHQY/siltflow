export interface ParagraphStyle {
  /** Ordered list of font names (CSS font-family stack) for content text. */
  fontFamilies: string[];
  /** Font size in px for content text. */
  fontSize: number;
  /** Global base font size in px (applied to <html>). */
  globalFontSize: number;
  /** Whether to show the PDF scrollbar (floating overlay style). */
  pdfScrollbar: boolean;
  /** Ordered list of font names for UI (buttons, bars, lists). */
  systemFontFamilies: string[];
  /** Max height (px) for the Learn panel (study dialog). */
  learnPanelHeight: number;
}
