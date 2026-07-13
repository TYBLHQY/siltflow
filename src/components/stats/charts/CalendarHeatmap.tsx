import { useMemo, useState } from "react";
import { ChartCard } from "../ChartCard";
import { computeCalendarHeatmap } from "@/lib/stats-computation";
import { useStatsStore } from "@/stores/stats.store";
import { cn } from "@/lib/utils";

const RANGES = [
  { label: "3mo", months: 3 },
  { label: "6mo", months: 6 },
  { label: "12mo", months: 12 },
] as const;

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const FILL_COLORS = [
  "var(--cal-0)",
  "var(--cal-1)",
  "var(--cal-2)",
  "var(--cal-3)",
  "var(--cal-4)",
];

function getFill(count: number, max: number): string {
  if (count === 0) return FILL_COLORS[0];
  if (max === 0) return FILL_COLORS[1];
  const ratio = count / max;
  const idx = Math.min(Math.floor(ratio * (FILL_COLORS.length - 1)), FILL_COLORS.length - 1);
  return FILL_COLORS[Math.max(idx, 1)];
}

export function CalendarHeatmap() {
  const logs = useStatsStore((s) => s.rawReviewLogs);
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const loading = useStatsStore((s) => s.loading);
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);

  const heatmap = useMemo(
    () => computeCalendarHeatmap(logs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, dataVersion],
  );

  const { cells, maxCount } = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - range.months);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const cellsArr: { date: string; count: number; dayOfWeek: number; week: number }[] = [];
    let max = 0;
    const d = new Date(start);
    while (d <= now) {
      const dateStr = d.toISOString().slice(0, 10);
      const count = heatmap.get(dateStr) ?? 0;
      if (count > max) max = count;
      cellsArr.push({
        date: dateStr,
        count,
        dayOfWeek: d.getDay(),
        week: Math.floor((d.getTime() - start.getTime()) / (7 * 86400000)),
      });
      d.setDate(d.getDate() + 1);
    }
    return { cells: cellsArr, maxCount: max };
  }, [heatmap, range.months]);

  const isEmpty = cells.every((c) => c.count === 0);

  // Group cells into weeks (columns) x days (rows)
  const weeksMap = new Map<number, Map<number, typeof cells[number]>>();
  for (const cell of cells) {
    if (!weeksMap.has(cell.week)) weeksMap.set(cell.week, new Map());
    weeksMap.get(cell.week)!.set(cell.dayOfWeek, cell);
  }
  const weekKeys = Array.from(weeksMap.keys()).sort((a, b) => a - b);

  return (
    <ChartCard
      title="Calendar Heatmap"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="No review activity yet"
    >
      <div className="mb-2 flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.label}
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
              range.months === r.months
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
            onClick={() => setRange(r)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg width={weekKeys.length * 14 + 30} height={130} className="shrink-0">
          {/* Day labels */}
          {DAY_LABELS.map((label, i) => (
            <text
              key={i}
              x={2}
              y={i * 16 + 11}
              fontSize={9}
              fill="var(--lavender)"
            >
              {label}
            </text>
          ))}
          {/* Cells */}
          {weekKeys.map((wk) => {
            const dayMap = weeksMap.get(wk)!;
            return Array.from({ length: 7 }, (_, day) => {
              const cell = dayMap.get(day);
              if (!cell) return null;
              return (
                <rect
                  key={`${wk}-${day}`}
                  x={wk * 14 + 30}
                  y={day * 16 + 2}
                  width={11}
                  height={11}
                  rx={2}
                  fill={getFill(cell.count, maxCount)}
                  stroke="var(--surface0)"
                  strokeWidth={0.5}
                >
                  <title>{`${cell.date}: ${cell.count} reviews`}</title>
                </rect>
              );
            });
          })}
        </svg>
      </div>
    </ChartCard>
  );
}
