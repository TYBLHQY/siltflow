import { useEffect, useRef, useState } from "react";
import { X, BarChart3 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useStatsStore } from "@/stores/stats.store";
import { OverviewCards } from "./OverviewCards";
import { LazyChart } from "./LazyChart";
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
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Statistics</h2>
        </div>
        {onClose && (
          <button
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
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
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-text hover:bg-accent",
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
                <LazyChart height={300}><DailyReviewsChart /></LazyChart>
                <LazyChart height={240}><CalendarHeatmap /></LazyChart>
                <LazyChart height={300}><ReviewForecastChart /></LazyChart>
              </div>
            )}
            {activePanel === "memory" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <LazyChart height={300}><RecallRateChart /></LazyChart>
                  <LazyChart height={300}><StabilityDistributionChart /></LazyChart>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <LazyChart height={300}><RetrievabilityDistributionChart /></LazyChart>
                  <LazyChart height={300}><DifficultyDistributionChart /></LazyChart>
                </div>
                <LazyChart height={300}><IntervalDistributionChart /></LazyChart>
              </div>
            )}
            {activePanel === "growth" && (
              <div className="space-y-4">
                <LazyChart height={320}><KnowledgeGrowthChart /></LazyChart>
                <LazyChart height={320}><ForgettingCurveChart /></LazyChart>
                <LazyChart height={300}><RetentionOptimizationChart /></LazyChart>
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
