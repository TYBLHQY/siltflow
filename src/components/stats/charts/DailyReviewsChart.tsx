import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { computeDailyReviews } from "@/lib/stats-computation";
import { useStatsStore } from "@/stores/stats.store";

const TIME_RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "All", days: 0 },
] as const;

export function DailyReviewsChart() {
  const logs = useStatsStore((s) => s.rawReviewLogs);
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const loading = useStatsStore((s) => s.loading);
  const [range, setRange] = useState<(typeof TIME_RANGES)[number]>(TIME_RANGES[1]);

  const data = useMemo(
    () => computeDailyReviews(logs, range.days || undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, range.days, dataVersion],
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
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            formatter={(value: any, name: any) => [
              `${value} reviews`,
              name === "learnCount" ? "Learning" : "Review",
            ]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--tooltip-bg)",
            }}
          />
          <Legend verticalAlign="top"
            wrapperStyle={{ fontSize: 11 }}
            content={({ payload }) => {
              const swatchColors = ["var(--yellow)", "var(--sky)"];
              const labels = ["Learning", "Review"];
              return (
                <div className="mb-2 flex justify-center gap-4 text-xs">
                  {payload?.map((entry, idx) => (
                    <div key={entry.value} className="flex items-center gap-1">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: swatchColors[idx] }}
                      />
                      <span className="text-foreground">{labels[idx]}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Bar
            dataKey="learnCount"
            name="learnCount"
            stackId="a"
            fill="var(--yellow)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="reviewCount"
            name="reviewCount"
            stackId="a"
            fill="var(--sky)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.label}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              range.days === r.days
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-accent"
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
