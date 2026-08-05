import { createContext, useContext } from "react";

/**
 * True while an Allotment sash is being dragged (panel resizing in progress).
 *
 * Consumed by the PDF viewer: while resizing, fit-to-width re-layout is frozen
 * so each pointermove tick doesn't trigger a full-resolution pdf.js re-render
 * (see the guard in PdfHighlighterWrapper). The layout re-runs once on release.
 *
 * Signal source: Allotment's sash is `[data-testid="sash"]` (set in
 * allotment's module.js) and drags use Pointer Events, so the provider detects
 * drag start via a document-level pointerdown delegated to the sash, and end
 * via a window pointerup. This avoids prop-drilling a drag state down the
 * layout tree (which would re-render the whole layout on every frame) and
 * stays robust to the sash mounting after the provider mounts.
 *
 * Fallback if Allotment ever stops emitting native pointer events: the
 * Allotment component exposes onDragStart/onDragEnd React props
 * (module.js destructures them) — wire those up here instead.
 */
export const PanelResizeStateContext = createContext<boolean>(false);

/** True while any Allotment sash is being dragged. */
export function usePanelResizeState(): boolean {
  return useContext(PanelResizeStateContext);
}
