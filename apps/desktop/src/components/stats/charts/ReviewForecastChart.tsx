import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { StatChartCard, ChartGrid, CHART_TOOLTIP_STYLE } from "../ChartPresets";
import { useChartData } from "@/hooks/useChartData";
import { computeReviewForecast } from "@/lib/stats-computation";

export function ReviewForecastChart() {
  const { cards, loading } = useChartData();

  const data = useMemo(() => computeReviewForecast(cards, 14), [cards]);

  const isEmpty = data.every((d) => d.dueCount === 0);

  return (
    <StatChartCard
      title="Review Forecast (14 days)"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="No cards due soon"
    >
      <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <ChartGrid />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9 }}
          tickFormatter={(d: string) => {
            const date = new Date(d + "T00:00:00");
            return date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
          }}
          stroke="var(--catppuccin-color-text)"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10 }}
          stroke="var(--catppuccin-color-text)"
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(label: any) => {
            const d = new Date(String(label) + "T00:00:00");
            return d.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
          }}
        />
        <ReferenceLine
          y={0}
          stroke="var(--catppuccin-color-text)"
          strokeDasharray="3 3"
        />
        <Bar
          dataKey="dueCount"
          name="Due"
          fill="var(--catppuccin-color-green)"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </StatChartCard>
  );
}
