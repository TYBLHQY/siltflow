import { useState, useCallback, useRef } from "react";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { LeftPanel } from "./LeftPanel";
import { CenterPanel } from "./CenterPanel";
import { RightPanel } from "./RightPanel";
import { useDocumentStore } from "@/stores/document.store";
import { useAnnotationStore } from "@/stores/annotation.store";
import {
  usePdfViewerStore,
  type SelectionMode,
} from "@/stores/pdf-viewer.store";
import { usePanelLayout } from "@/hooks/usePanelLayout";
import { useShortcut } from "@/hooks/useShortcut";

const MIN_PANEL_PX = 300;
const MAX_PANEL_PX = 600;

export function ThreeColumnLayout() {
  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const { layout, loaded, saveLayout } = usePanelLayout();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftTab, setLeftTab] = useState<string>("review");
  const [rightTab, setRightTab] = useState<string>("annotations");

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const handleToggleLeft = useCallback(() => {
    if (!leftPanelRef.current) return;
    const parent = leftPanelRef.current.parentElement;
    if (!parent) return;
    // allotment collapses by setting the pane to 0
    // we toggle via a CSS class and the pane collapses
    setLeftCollapsed((c) => !c);
  }, []);

  const handleToggleRight = useCallback(() => {
    setRightCollapsed((c) => !c);
  }, []);

  const handleSettingsOpen = useCallback(() => {
    // Open settings via the CenterPanel's SettingsButton
    // We dispatch a custom event that CenterPanel listens to
    window.dispatchEvent(new CustomEvent("siltflow:toggle-settings"));
  }, []);

  const handleToggleFitWidth = useCallback(() => {
    const pf = usePdfViewerStore.getState();
    // Fit-width is implemented as a numeric scale that tracks the container
    // width (see the ResizeObserver in PdfHighlighterWrapper), so toggling
    // just flips the flag — opening it applies a fit-width numeric scale on
    // the next observer tick, closing it keeps whatever zoom is currently set.
    pf.setFitWidth(!pf.fitWidth);
  }, []);

  const handleToggleQuickAdd = useCallback(() => {
    const pf = usePdfViewerStore.getState();
    const modes: SelectionMode[] = [
      "manual",
      "auto-annotate",
      "auto-highlight",
    ];
    const idx = modes.indexOf(pf.selectionMode);
    pf.setSelectionMode(modes[(idx + 1) % 3]);
  }, []);

  // Add-manual-annotation: reveal the annotations tab and open the dialog.
  // The dialog visibility lives in the annotation store, so this works even
  // when the right panel is collapsed or the Annotations tab is unmounted
  // (the dialog opens as soon as the tab mounts and reads the store state).
  const handleAddManualAnnotation = useCallback(() => {
    setRightTab("annotations");
    setRightCollapsed(false);
    useAnnotationStore.getState().openManualDialog();
  }, []);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  const hasPdf = !!currentDocument?.id;

  // Tab shortcuts: set tab state AND auto-open the panel if it was collapsed
  const goDocsTab = useCallback(() => {
    setLeftTab("documents");
    setLeftCollapsed(false);
  }, []);
  const goReviewTab = useCallback(() => {
    setLeftTab("review");
    setLeftCollapsed(false);
  }, []);
  const goOutlinesTab = useCallback(() => {
    setLeftTab("outline");
    setLeftCollapsed(false);
  }, []);
  const goAnnotationsTab = useCallback(() => {
    setRightTab("annotations");
    setRightCollapsed(false);
  }, []);
  const goSummaryTab = useCallback(() => {
    setRightTab("summary");
    setRightCollapsed(false);
  }, []);

  useShortcut("toggleDocsTab", goDocsTab);
  useShortcut("toggleReviewTab", goReviewTab);
  useShortcut("toggleOutlinesTab", goOutlinesTab);
  useShortcut("toggleAnnotationsTab", goAnnotationsTab);
  useShortcut("toggleSummaryTab", goSummaryTab);
  useShortcut("toggleLeftPanel", handleToggleLeft);
  useShortcut("toggleRightPanel", handleToggleRight);
  useShortcut("openSettings", handleSettingsOpen);
  useShortcut("toggleFitWidth", handleToggleFitWidth, { enabled: hasPdf });
  useShortcut("toggleQuickAdd", handleToggleQuickAdd, { enabled: hasPdf });
  useShortcut("addManualAnnotation", handleAddManualAnnotation, {
    enabled: hasPdf,
  });
  // ──────────────────────────────────────────────────────────────────────────

  // Wait for layout to restore before rendering
  if (!loaded) return null;

  // Convert saved percentages to pixel sizes based on a typical window.
  // If saved layout exists, weight left/right as initial sizes in pixels.
  const leftSize = layout?.[0]
    ? Math.round((layout[0] / 100) * window.innerWidth)
    : 300;
  const rightSize = layout?.[2]
    ? Math.round((layout[2] / 100) * window.innerWidth)
    : 300;

  return (
    <div className="h-screen w-screen">
      <Allotment
        defaultSizes={[
          leftSize,
          Math.max(window.innerWidth - leftSize - rightSize, 400),
          rightSize,
        ]}
        onChange={(sizes) => {
          if (sizes.length === 3) {
            const total = sizes[0] + sizes[1] + sizes[2];
            if (total > 0) {
              saveLayout([
                Math.round((sizes[0] / total) * 100),
                Math.round((sizes[1] / total) * 100),
                Math.round((sizes[2] / total) * 100),
              ]);
            }
          }
        }}
        separator
      >
        <Allotment.Pane
          minSize={MIN_PANEL_PX}
          maxSize={MAX_PANEL_PX}
          preferredSize={300}
          visible={!leftCollapsed}
        >
          <div ref={leftPanelRef} className="h-full">
            <LeftPanel activeTab={leftTab} onTabChange={setLeftTab} />
          </div>
        </Allotment.Pane>

        <Allotment.Pane minSize={0}>
          <CenterPanel
            documentPath={
              currentDocument?.id
                ? `siltflow://documents/${currentDocument.id}.pdf`
                : undefined
            }
            documentId={currentDocument?.id}
            leftCollapsed={leftCollapsed}
            rightCollapsed={rightCollapsed}
            onToggleLeft={handleToggleLeft}
            onToggleRight={handleToggleRight}
          />
        </Allotment.Pane>

        <Allotment.Pane
          minSize={MIN_PANEL_PX}
          maxSize={MAX_PANEL_PX}
          preferredSize={300}
          visible={!rightCollapsed}
        >
          <div ref={rightPanelRef} className="h-full">
            <RightPanel activeTab={rightTab} onTabChange={setRightTab} />
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}
