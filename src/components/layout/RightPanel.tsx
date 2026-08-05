import { useRef, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconText } from "@/components/ui/icon-text";
import { Highlighter, FileText } from "lucide-react";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import { useSummaryStore } from "@/stores/summary.store";
import { useDocumentStore } from "@/stores/document.store";
import { AnnotationsTab } from "@/components/layout/right-panel/annotations-tab";
import { SummaryTab } from "@/components/layout/right-panel/summary-tab";
import { extractPageTexts } from "@/lib/summarize";

interface RightPanelProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function RightPanel({ activeTab, onTabChange }: RightPanelProps) {
  const pdfDocument = usePdfViewerStore((s) => s.pdfDocument);
  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const pageTexts = useSummaryStore((s) => s.pageTexts);
  const setPageTexts = useSummaryStore((s) => s.setPageTexts);
  const setSelectedPages = useSummaryStore((s) => s.setSelectedPages);

  const annotationsScrollRef = useRef<HTMLDivElement | null>(null);

  // When a highlight is clicked in the PDF, scroll the matching annotation card
  useEffect(() => {
    const handler = (e: Event) => {
      const { id } = (e as CustomEvent).detail;
      if (!id) return;
      onTabChange?.("annotations");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = annotationsScrollRef.current?.querySelector(
            `[data-annotation-id="${id}"]`,
          );
          if (!el) return;
          el.setAttribute("data-annotation-highlight", "true");
          setTimeout(
            () => el.removeAttribute("data-annotation-highlight"),
            2000,
          );

          // The card starts a 200ms grid-template-rows expand/collapse in the
          // same tick (annotations-tab expands it via annotation-click). scrollIntoView
          // computes its target from the geometry at call time, so scrolling mid-animation
          // lands off-center. Wait for the transition to settle, then scroll based on the
          // final geometry. A timeout backstops lost transitionend events (reduced motion,
          // display:none, property reset).
          const scrollWhenStable = () =>
            el.scrollIntoView({ block: "center", behavior: "smooth" });

          const grid = el.querySelector<HTMLElement>("[data-collapsible-grid]");
          if (!grid) {
            // Not a collapsible card — no height animation to wait for.
            scrollWhenStable();
            return;
          }
          // Does this card have a running grid-rows transition right now? The
          // click toggles expand/collapse via the same event, so if it changed
          // state a transition is in flight. If the card was already in the
          // target state (e.g. annotation-click re-selecting the same id) there
          // is no animation and the geometry is already stable. Reading the
          // computed gridTemplateRows mid-transition returns an interpolation
          // (neither "0px" nor the final px), so it can't distinguish these —
          // getAnimations() can.
          const hasRunningTransition = grid
            .getAnimations()
            .some(
              (a) => a instanceof CSSTransition && a.playState === "running",
            );
          if (!hasRunningTransition) {
            scrollWhenStable();
            return;
          }

          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            grid.removeEventListener("transitionend", onEnd);
            scrollWhenStable();
          };
          const onEnd = (te: TransitionEvent) => {
            // Only this card's height transition matters. Collapse (0fr) and
            // expand (1fr) endings are both stable-geometry points.
            if (te.propertyName !== "grid-template-rows") return;
            finish();
          };
          const timer = window.setTimeout(finish, 350); // duration-200 + margin
          grid.addEventListener("transitionend", onEnd);
        });
      });
    };
    window.addEventListener("siltflow:annotation-click", handler);
    return () =>
      window.removeEventListener("siltflow:annotation-click", handler);
  }, [onTabChange]);

  const docId = currentDocument?.id;
  const texts = docId ? pageTexts[docId] : undefined;

  // Lazy page-text extraction: only run when Summary tab is active.
  // Never cache — always re-extract when pdfDocument / docId / tab changes,
  // because docId and pdfDocument updates are not synchronised (PdfLoader is
  // async), so a stale pdfDocument could otherwise write the wrong document's
  // text into pageTexts before the cache guard blocks the correct extraction.
  const extractionGen = useRef(0);
  useEffect(() => {
    if (!pdfDocument || !docId) return;
    if (activeTab !== "summary") return;

    const gen = ++extractionGen.current;
    extractPageTexts(pdfDocument)
      .then((texts) => {
        if (gen !== extractionGen.current) return;
        setPageTexts(docId, texts);
      })
      .catch((err) => {
        if (gen !== extractionGen.current) return;
        console.error("Failed to extract page texts:", err);
      });
  }, [pdfDocument, docId, activeTab, setPageTexts]);

  // When page texts are first loaded, select only the first page by default
  useEffect(() => {
    if (docId && texts && texts.length > 0) {
      const selectedPages = useSummaryStore.getState().selectedPages;
      if (selectedPages[docId] === undefined) {
        setSelectedPages(docId, [1]);
      }
    }
  }, [docId, texts, setSelectedPages]);

  return (
    <div className="flex h-full flex-col">
      <Tabs
        defaultValue="annotations"
        value={activeTab ?? undefined}
        onValueChange={onTabChange}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="flex h-10 items-center border-b px-3">
          <TabsList className="w-full h-7 text-ctp-text">
            <TabsTrigger
              value="annotations"
              className="flex-1 text-xs px-2 py-0.5 h-6"
            >
              <IconText icon={Highlighter} size="xs">
                Annotations
              </IconText>
            </TabsTrigger>
            <TabsTrigger
              value="summary"
              className="flex-1 text-xs px-2 py-0.5 h-6"
              disabled={!docId}
            >
              <IconText icon={FileText} size="xs">
                Summary
              </IconText>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="annotations"
          className="flex-1 min-h-0 mt-0 flex flex-col"
        >
          <AnnotationsTab
            onTabChange={onTabChange}
            annotationsScrollRef={annotationsScrollRef}
          />
        </TabsContent>

        <TabsContent
          value="summary"
          className="flex-1 min-h-0 mt-0 flex flex-col"
        >
          <SummaryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
