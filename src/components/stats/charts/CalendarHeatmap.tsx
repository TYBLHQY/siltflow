import { useMemo } from "react";
import { ChartCard } from "../ChartCard";
import { CalendarGrid } from "../CalendarGrid";
import { useChartData } from "@/hooks/useChartData";
import { computeCalendarHeatmap } from "@/lib/stats-computation";

const PANEL_COLORS = [
  "var(--heatmap-0)", "var(--heatmap-1)", "var(--heatmap-2)",
  "var(--heatmap-3)", "var(--heatmap-4)",
];

export function CalendarHeatmap() {
  const { logs, loading } = useChartData();

  const heatmap = useMemo(
    () => computeCalendarHeatmap(logs),
    [logs],
  );

  const { endDate, rangeDays } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    return { endDate: end, rangeDays: days };
  }, []);

  const data = useMemo(() => {
    const arr: { date: string; value: number }[] = [];
    for (const [date, count] of heatmap) arr.push({ date, value: count });
    return arr;
  }, [heatmap]);

  const isEmpty = data.length === 0;

  return (
    <ChartCard title="Calendar Heatmap" loading={loading} isEmpty={isEmpty} emptyMessage="No review activity yet">
      <div className="overflow-x-auto flex justify-center">
        <CalendarGrid
          title="" data={data} rangeDays={rangeDays} endDate={endDate}
          cellSize={11} cellGap={3} weekStartsOn={0} palette={PANEL_COLORS}
          levelClassNames={undefined} legend={{ show: false }}
          axisLabels={{ weekdayIndices: [1, 3, 5] }}
          className="w-fit shrink-0"
        />
      </div>
    </ChartCard>
  );
}
