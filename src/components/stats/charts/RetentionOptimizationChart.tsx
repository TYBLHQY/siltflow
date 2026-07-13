import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { computeRetentionTradeoff } from "@/lib/stats-computation";
import { useStatsStore } from "@/stores/stats.store";

export function RetentionOptimizationChart() {
  const parsedCards = useStatsStore((s) => s.parsedCards);
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const loading = useStatsStore((s) => s.loading);

  const data = useMemo(
    () => computeRetentionTradeoff(Array.from(parsedCards.values()), 0.85),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsedCards, dataVersion],
  );

  const isEmpty = data.length === 0 || data.every((d) => d.workload === 0);

  return (
    <ChartCard
      title="Retention Optimization"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Not enough reviewed cards yet"
    >
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="targetRetention"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            stroke="var(--text)"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10 }}
            stroke="var(--text)"
            label={{
              value: "Reviews/day",
              angle: -90,
              position: "insideLeft",
              offset: 0,
              fontSize: 10,
              fill: "var(--text)",
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10 }}
            stroke="var(--text)"
            label={{
              value: "Avg stability (d)",
              angle: 90,
              position: "insideRight",
              offset: 0,
              fontSize: 10,
              fill: "var(--text)",
            }}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--tooltip-bg)",
            }}
            formatter={(value: any, name: any) => {
              if (name === "Reviews/day") return [(Number(value) as number).toFixed(1), name as string];
              if (name === "Avg stability (d)")
                return [`${Number(value).toFixed(1)}d`, name as string];
              return [value, name as string];
            }}
          />
          <Legend verticalAlign="bottom"
            wrapperStyle={{ fontSize: 11 }}
            content={({ payload }) => {
              const colors: Record<string, string> = {
                "Reviews/day": "var(--peach)",
                "Avg stability (d)": "var(--mauve)",
              };
              return (
                <div className="mt-2 flex justify-center gap-4 text-xs">
                  {payload?.map((entry) => (
                    <div key={entry.value} className="flex items-center gap-1">
                      {(entry.value as string) === "Avg stability (d)" ? (
                        <span
                          className="inline-block h-0.5 w-3 rounded-full"
                          style={{ backgroundColor: colors[entry.value as string] ?? "var(--text)" }}
                        />
                      ) : (
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ backgroundColor: colors[entry.value as string] ?? "var(--text)" }}
                        />
                      )}
                      <span className="text-foreground">{entry.value}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Bar
            yAxisId="left"
            dataKey="workload"
            name="Reviews/day"
            fill="var(--peach)"
            radius={[3, 3, 0, 0]}
            opacity={0.8}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgStability"
            name="Avg stability (d)"
            stroke="var(--mauve)"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
