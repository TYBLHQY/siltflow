import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { ChartGrid, CHART_TOOLTIP_STYLE } from "../ChartPresets";
import { useChartData } from "@/hooks/useChartData";
import { computeDailyReviews } from "@/lib/stats-computation";

const TIME_RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "All", days: 0 },
] as const;

export function DailyReviewsChart() {
  const { logs, loading } = useChartData();
  const [range, setRange] = useState<(typeof TIME_RANGES)[number]>(TIME_RANGES[1]);

  const data = useMemo(
    () => computeDailyReviews(logs, range.days || undefined),
    [logs, range.days],
  );

  return (
    <ChartCard
      title="Daily Reviews"
      loading={loading}
      isEmpty={data.length === 0}
      emptyMessage="No reviews yet"
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <ChartGrid />
          <XAxis
            dataKey="date" tick={{ fontSize: 10 }}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              `${value} reviews`,
              name === "learnCount" ? "Learning" : "Review",
            ]}
            contentStyle={CHART_TOOLTIP_STYLE}
          />
          <Legend
            verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }}
            content={({ payload }) => {
              const swatchColors = ["var(--catppuccin-color-green)", "var(--catppuccin-color-peach)"];
              const labels = ["Learning", "Review"];
              return (
                <div className="mt-2 flex justify-center gap-4 text-xs">
                  {payload?.map((entry, idx) => (
                    <div key={entry.value} className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: swatchColors[idx] }} />
                      <span className="text-ctp-text">{labels[idx]}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Bar dataKey="learnCount" name="learnCount" stackId="a"
            fill="var(--catppuccin-color-green)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="reviewCount" name="reviewCount" stackId="a"
            fill="var(--catppuccin-color-peach)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.label}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              range.days === r.days
                ? "bg-ctp-mauve text-ctp-crust"
                : "bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface0"
            }`}
            onClick={() => setRange(r)}
          >
            {r.label}
          </button>
        ))}
      </div>
    </ChartCard>
  );
}
