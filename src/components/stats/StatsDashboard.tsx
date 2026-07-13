import { useEffect, useRef } from "react";
import { X, BarChart3 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface StatsDashboardProps {
  onClose?: () => void;
}

export function StatsDashboard({ onClose }: StatsDashboardProps) {
  const loadAllData = useStatsStore((s) => s.loadAllData);
  const loaded = useStatsStore((s) => s.loaded);
  const containerRef = useRef<HTMLDivElement>(null);

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

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {/* Overview */}
          <section>
            <OverviewCards />
          </section>

          {/* Learning */}
          <details open className="group">
            <summary className="mb-3 cursor-pointer text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
              Learning
            </summary>
            <LazyChart height={300}><DailyReviewsChart /></LazyChart>
            <div className="mt-4">
              <LazyChart height={240}><CalendarHeatmap /></LazyChart>
            </div>
            <div className="mt-4">
              <LazyChart height={300}><ReviewForecastChart /></LazyChart>
            </div>
          </details>

          {/* Memory (FSRS) */}
          <details open className="group">
            <summary className="mb-3 cursor-pointer text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
              Memory (FSRS)
            </summary>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <LazyChart height={300}><RecallRateChart /></LazyChart>
              <LazyChart height={300}><StabilityDistributionChart /></LazyChart>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <LazyChart height={300}><RetrievabilityDistributionChart /></LazyChart>
              <LazyChart height={300}><DifficultyDistributionChart /></LazyChart>
            </div>
            <div className="mt-4">
              <LazyChart height={300}><IntervalDistributionChart /></LazyChart>
            </div>
          </details>

          {/* Growth */}
          <details open className="group">
            <summary className="mb-3 cursor-pointer text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
              Growth
            </summary>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <LazyChart height={320}><KnowledgeGrowthChart /></LazyChart>
              <LazyChart height={320}><ForgettingCurveChart /></LazyChart>
            </div>
            <div className="mt-4">
              <LazyChart height={300}><RetentionOptimizationChart /></LazyChart>
            </div>
          </details>

          {/* Memory State Explorer */}
          <details className="group">
            <summary className="mb-3 cursor-pointer text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
              Memory State Explorer
            </summary>
            <LazyChart height={400}><MemoryStateExplorer /></LazyChart>
          </details>
        </div>
      </ScrollArea>
    </div>
  );
}
