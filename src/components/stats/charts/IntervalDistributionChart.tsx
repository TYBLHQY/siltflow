import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { StatChartCard, ChartGrid, CHART_TOOLTIP_STYLE } from "../ChartPresets";
import { useChartData } from "@/hooks/useChartData";
import { computeIntervalHistogram } from "@/lib/stats-computation";

export function IntervalDistributionChart() {
  const { cards, loading } = useChartData();

  const data = useMemo(
    () => computeIntervalHistogram(cards),
    [cards],
  );

  const isEmpty = data.every((d) => d.count === 0);

  return (
    <StatChartCard
      title="Interval Distribution"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="No reviewed cards yet"
    >
      <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <ChartGrid />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Bar dataKey="count" name="Cards" fill="var(--catppuccin-color-sapphire)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </StatChartCard>
  );
}
