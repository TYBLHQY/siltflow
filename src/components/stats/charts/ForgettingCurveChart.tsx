import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { computeForgettingCurves, FORGETTING_LABELS } from "@/lib/stats-computation";
import { useStatsStore } from "@/stores/stats.store";

const LINE_COLORS = [
  "var(--red)",
  "var(--peach)",
  "var(--green)",
  "var(--blue)",
  "var(--mauve)",
];

export function ForgettingCurveChart() {
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const loading = useStatsStore((s) => s.loading);
  const [maxDays, setMaxDays] = useState(90);

  const data = useMemo(
    () => computeForgettingCurves(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataVersion],
  );

  const filtered = useMemo(
    () => data.filter((d) => d.day <= maxDays),
    [data, maxDays],
  );

  return (
    <ChartCard
      title="Forgetting Curves"
      loading={loading}
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={filtered}
          margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10 }}
            stroke="var(--lavender)"
            label={{
              value: "Days elapsed",
              position: "insideBottomRight",
              offset: -4,
              fontSize: 10,
              fill: "var(--lavender)",
            }}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            stroke="var(--lavender)"
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--tooltip-bg)",
            }}
            formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`}
          />
          <Legend verticalAlign="top"
            wrapperStyle={{ fontSize: 11 }}
            content={({ payload }) => (
              <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
                {payload?.map((entry, idx) => (
                  <div key={entry.value} className="flex items-center gap-1">
                    <span
                      className="inline-block h-0.5 w-3 rounded-full"
                      style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }}
                    />
                    <span className="text-foreground">{entry.value}</span>
                  </div>
                ))}
              </div>
            )}
          />
          {FORGETTING_LABELS.map((label, i) => (
            <Line
              key={label}
              type="monotone"
              dataKey={label}
              name={label}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={1.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-1">
        {[30, 90, 180, 365].map((d) => (
          <button
            key={d}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              maxDays === d
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-accent"
            }`}
            onClick={() => setMaxDays(d)}
          >
            {d}d
          </button>
        ))}
      </div>
    </ChartCard>
  );
}
