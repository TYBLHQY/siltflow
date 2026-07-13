import { useMemo } from "react";
import { ChartCard } from "../ChartCard";
import { HeatmapCalendar } from "../HeatmapCalendar";
import { computeCalendarHeatmap } from "@/lib/stats-computation";
import { useStatsStore } from "@/stores/stats.store";

const PANEL_COLORS = [
  "var(--cal-0)",
  "#9be9a8",
  "#54d17a",
  "#2da44e",
  "#116329",
];

export function CalendarHeatmap() {
  const logs = useStatsStore((s) => s.rawReviewLogs);
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const loading = useStatsStore((s) => s.loading);

  const heatmap = useMemo(
    () => computeCalendarHeatmap(logs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, dataVersion],
  );

  // Calendar year range: Jan 1 – Dec 31 of current year
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
    for (const [date, count] of heatmap) {
      arr.push({ date, value: count });
    }
    return arr;
  }, [heatmap]);

  const isEmpty = data.length === 0;

  return (
    <ChartCard
      title="Calendar Heatmap"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="No review activity yet"
    >
      <div className="overflow-x-auto flex justify-center">
        <HeatmapCalendar
          title=""
          data={data}
          rangeDays={rangeDays}
          endDate={endDate}
          cellSize={11}
          cellGap={3}
          weekStartsOn={0}
          palette={PANEL_COLORS}
          levelClassNames={undefined}
          legend={{ show: false }}
          axisLabels={{
            weekdayIndices: [1, 3, 5],
          }}
          className="w-fit shrink-0"
        />
      </div>
    </ChartCard>
  );
}
