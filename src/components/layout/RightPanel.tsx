import { useRef, useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconText } from "@/components/ui/icon-text";
import { Highlighter, FileText } from "lucide-react";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import { useSummaryStore } from "@/stores/summary.store";
import { useDocumentStore } from "@/stores/document.store";
import { extractPageTexts } from "@/lib/summarize";
import { AnnotationsTab } from "@/components/layout/right-panel/annotations-tab";
import { SummaryTab } from "@/components/layout/right-panel/summary-tab";

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

  const annotationsScrollRef = useRef<HTMLDivElement>(null);

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
          if (el) {
            el.setAttribute("data-annotation-highlight", "true");
            setTimeout(() => el.removeAttribute("data-annotation-highlight"), 2000);
          }
          el?.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      });
    };
    window.addEventListener("siltflow:annotation-click", handler);
    return () => window.removeEventListener("siltflow:annotation-click", handler);
  }, [onTabChange]);

  const docId = currentDocument?.id;
  const texts = docId ? pageTexts[docId] : undefined;
  const docIdRef = useRef(docId);
  docIdRef.current = docId;
  const extractGen = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_extracting, setExtracting] = useState(false);

  // Extract page texts when a new pdfDocument arrives
  useEffect(() => {
    if (!pdfDocument) return;
    const id = docIdRef.current;
    if (!id) return;
    if (pageTexts[id]) return;

    const gen = ++extractGen.current;
    setExtracting(true);

    extractPageTexts(pdfDocument)
      .then((texts) => {
        if (gen !== extractGen.current) return;
        setPageTexts(id, texts);
      })
      .catch((err) => {
        if (gen !== extractGen.current) return;
        console.error("Failed to extract page texts:", err);
      })
      .finally(() => {
        if (gen === extractGen.current) setExtracting(false);
      });
  }, [pdfDocument, pageTexts, setExtracting, setPageTexts]);

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
          <TabsList className="w-full h-7 text-foreground">
            <TabsTrigger value="annotations" className="flex-1 text-xs px-2 py-0.5 h-6">
              <IconText icon={Highlighter} size="xs">Annotations</IconText>
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex-1 text-xs px-2 py-0.5 h-6" disabled={!docId}>
              <IconText icon={FileText} size="xs">Summary</IconText>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="annotations" className="flex-1 min-h-0 mt-0 flex flex-col">
          <AnnotationsTab
            onTabChange={onTabChange}
            annotationsScrollRef={annotationsScrollRef}
          />
        </TabsContent>

        <TabsContent value="summary" className="flex-1 min-h-0 mt-0 flex flex-col">
          <SummaryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
