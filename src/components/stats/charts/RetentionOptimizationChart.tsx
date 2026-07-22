import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "../ChartCard";
import { ChartGrid, CHART_TOOLTIP_STYLE } from "../ChartPresets";
import { useChartData } from "@/hooks/useChartData";
import { computeRetentionTradeoff } from "@/lib/stats-computation";

export function RetentionOptimizationChart() {
  const { cards, loading } = useChartData();

  const data = useMemo(() => computeRetentionTradeoff(cards, 0.85), [cards]);

  const isEmpty = data.length === 0 || data.every((d) => d.workload === 0);

  return (
    <ChartCard
      title="Retention Optimization"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Not enough reviewed cards yet"
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
        >
          <ChartGrid />
          <XAxis
            dataKey="targetRetention"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            stroke="var(--catppuccin-color-text)"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="var(--catppuccin-color-text)"
            label={{
              value: "Reviews/day",
              angle: -90,
              position: "insideLeft",
              offset: 0,
              fontSize: 10,
              fill: "var(--catppuccin-color-text)",
            }}
          />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          <Bar
            dataKey="workload"
            name="Reviews/day"
            fill="var(--catppuccin-color-peach)"
            radius={[3, 3, 0, 0]}
            opacity={0.8}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
