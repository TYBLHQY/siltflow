import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { StatChartCard, ChartGrid, CHART_TOOLTIP_STYLE } from "../ChartPresets";
import { useChartData } from "@/hooks/useChartData";
import { computeRetrievabilityHistogram, computeOverviewStats } from "@/lib/stats-computation";

export function RetrievabilityDistributionChart() {
  const { cards, loading } = useChartData();

  const data = useMemo(
    () => computeRetrievabilityHistogram(cards),
    [cards],
  );

  const overview = useMemo(
    () => computeOverviewStats(cards),
    [cards],
  );

  const isEmpty = data.every((d) => d.count === 0);

  return (
    <StatChartCard title="Retrievability Distribution" loading={loading} isEmpty={isEmpty} emptyMessage="No reviewed cards yet">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <ChartGrid />
        <XAxis dataKey="label" tick={{ fontSize: 9 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <ReferenceLine
          x={Math.min(Math.floor(overview.avgRetrievability * 10), 9)}
          strokeDasharray="3 3"
          label={{ value: "avg", position: "top", fontSize: 10, fill: "var(--catppuccin-color-red)" }} />
        <Bar dataKey="count" fill="var(--catppuccin-color-maroon)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </StatChartCard>
  );
}
