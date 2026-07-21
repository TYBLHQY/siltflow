import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { ChartGrid, CHART_TOOLTIP_STYLE } from "../ChartPresets";
import { useChartData } from "@/hooks/useChartData";
import { computeRetentionTradeoff } from "@/lib/stats-computation";

export function RetentionOptimizationChart() {
  const { cards, loading } = useChartData();

  const data = useMemo(
    () => computeRetentionTradeoff(cards, 0.85),
    [cards],
  );

  const isEmpty = data.length === 0 || data.every((d) => d.workload === 0);

  return (
    <ChartCard title="Retention Optimization" loading={loading} isEmpty={isEmpty} emptyMessage="Not enough reviewed cards yet">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <ChartGrid />
          <XAxis dataKey="targetRetention" tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`} stroke="var(--catppuccin-color-text)" />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="var(--catppuccin-color-text)"
            label={{ value: "Reviews/day", angle: -90, position: "insideLeft", offset: 0, fontSize: 10, fill: "var(--catppuccin-color-text)" }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="var(--catppuccin-color-text)"
            label={{ value: "Avg stability (d)", angle: 90, position: "insideRight", offset: 0, fontSize: 10, fill: "var(--catppuccin-color-text)" }} />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }}
            content={({ payload }) => {
              const colors: Record<string, string> = {
                "Reviews/day": "var(--catppuccin-color-peach)",
                "Avg stability (d)": "var(--catppuccin-color-mauve)",
              };
              return (
                <div className="mt-2 flex justify-center gap-4 text-xs">
                  {payload?.map((entry) => (
                    <div key={entry.value} className="flex items-center gap-1">
                      {(entry.value as string) === "Avg stability (d)" ? (
                        <span className="inline-block h-0.5 w-3 rounded-full"
                          style={{ backgroundColor: colors[entry.value as string] ?? "var(--catppuccin-color-text)" }} />
                      ) : (
                        <span className="inline-block h-2 w-2 rounded-sm"
                          style={{ backgroundColor: colors[entry.value as string] ?? "var(--catppuccin-color-text)" }} />
                      )}
                      <span className="text-ctp-text">{entry.value}</span>
                    </div>
                  ))}
                </div>
              );
            }} />
          <Bar yAxisId="left" dataKey="workload" name="Reviews/day" fill="var(--catppuccin-color-peach)" radius={[3, 3, 0, 0]} opacity={0.8} />
          <Line yAxisId="right" type="monotone" dataKey="avgStability" name="Avg stability (d)" stroke="var(--catppuccin-color-mauve)" strokeWidth={2} dot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
