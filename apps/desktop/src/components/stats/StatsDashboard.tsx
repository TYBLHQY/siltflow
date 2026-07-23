import { useEffect, useRef, useState } from "react";
import { X, BarChart3 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useStatsStore } from "@/stores/stats.store";
import { OverviewCards } from "./OverviewCards";
import { DailyReviewsChart } from "./charts/DailyReviewsChart";
import { CalendarHeatmap } from "./charts/CalendarHeatmap";
import { RecallRateChart } from "./charts/RecallRateChart";
import { StabilityDistributionChart } from "./charts/StabilityDistributionChart";
import { RetrievabilityDistributionChart } from "./charts/RetrievabilityDistributionChart";
import { DifficultyDistributionChart } from "./charts/DifficultyDistributionChart";
import { IntervalDistributionChart } from "./charts/IntervalDistributionChart";
import { KnowledgeGrowthChart } from "./charts/KnowledgeGrowthChart";
import { ReviewForecastChart } from "./charts/ReviewForecastChart";
import { ForgettingCurveChart } from "./charts/ForgettingCurveChart";
import { RetentionOptimizationChart } from "./charts/RetentionOptimizationChart";
import { MemoryStateExplorer } from "./charts/MemoryStateExplorer";

type Panel = "learning" | "memory" | "growth" | "explorer";

const PANELS: { id: Panel; label: string }[] = [
  { id: "learning", label: "Learning" },
  { id: "memory", label: "Memory (FSRS)" },
  { id: "growth", label: "Growth" },
  { id: "explorer", label: "Memory State Explorer" },
];

interface StatsDashboardProps {
  onClose?: () => void;
}

export function StatsDashboard({ onClose }: StatsDashboardProps) {
  const loadAllData = useStatsStore((s) => s.loadAllData);
  const loaded = useStatsStore((s) => s.loaded);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<Panel>("learning");
  const isExplorer = activePanel === "explorer";

  useEffect(() => {
    if (!loaded) loadAllData();
  }, [loaded, loadAllData]);

  // Close on Escape
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div ref={containerRef} className="flex h-full w-full select-none flex-col">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-ctp-overlay0" />
          <h2 className="text-sm font-semibold">Statistics</h2>
        </div>
        {onClose && (
          <button
            className="flex h-6 w-6 items-center justify-center rounded-md text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-text transition-colors"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content: fixed tabs + fill remaining space */}
      <div className="flex flex-1 flex-col min-h-0 gap-6 p-4">
        <section className="shrink-0">
          <OverviewCards />
        </section>

        <div className="flex gap-2 shrink-0">
          {PANELS.map((p) => (
            <button
              key={p.id}
              className={cn(
                "flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                activePanel === p.id
                  ? "border-ctp-mauve bg-ctp-mauve text-ctp-crust"
                  : "border-ctp-overlay0 text-ctp-text hover:bg-ctp-surface0",
              )}
              onClick={() => setActivePanel(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isExplorer ? (
          <div className="flex-1 min-h-0">
            <MemoryStateExplorer />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            {activePanel === "learning" && (
              <div className="space-y-4">
                <DailyReviewsChart />
                <CalendarHeatmap />
                <ReviewForecastChart />
              </div>
            )}
            {activePanel === "memory" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <RecallRateChart />
                  <StabilityDistributionChart />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <RetrievabilityDistributionChart />
                  <DifficultyDistributionChart />
                </div>
                <IntervalDistributionChart />
              </div>
            )}
            {activePanel === "growth" && (
              <div className="space-y-4">
                <KnowledgeGrowthChart />
                <ForgettingCurveChart />
                <RetentionOptimizationChart />
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
