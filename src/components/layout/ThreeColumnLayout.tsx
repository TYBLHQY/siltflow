import { useState, useCallback, useRef, useMemo } from 'react';
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { LeftPanel } from "./LeftPanel";
import { CenterPanel } from "./CenterPanel";
import { RightPanel } from "./RightPanel";
import { useDocumentStore } from "@/stores/document.store";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
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
    if (!pf.setViewerScale) return;
    if (pf.fitWidth) {
      pf.setViewerScale("auto");
      pf.setFitWidth(false);
      pf.setPdfScale(0);
    } else {
      pf.setViewerScale("page-width");
      pf.setFitWidth(true);
    }
  }, []);

  const handleToggleQuickAdd = useCallback(() => {
    const pf = usePdfViewerStore.getState();
    pf.setQuickAddEnabled(!pf.quickAddEnabled);
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
  // ──────────────────────────────────────────────────────────────────────────

  // Wait for layout to restore before rendering the interactive splitter,
  // but always render a full-height placeholder to prevent CLS (Cumulative
  // Layout Shift) from the jump 0 → screen.
  if (!loaded) return <div className="h-screen w-screen" />;

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

        <Allotment.Pane minSize={400}>
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
