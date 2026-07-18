import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { StatChartCard, ChartGrid, CHART_TOOLTIP_STYLE } from "../ChartPresets";
import { useChartData } from "@/hooks/useChartData";
import { computeDifficultyHistogram } from "@/lib/stats-computation";

export function DifficultyDistributionChart() {
  const { cards, loading } = useChartData();

  const data = useMemo(
    () => computeDifficultyHistogram(cards),
    [cards],
  );

  const isEmpty = data.every((d) => d.count === 0);

  return (
    <StatChartCard
      title="Difficulty Distribution"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="No reviewed cards yet"
    >
      <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <ChartGrid />
        <XAxis dataKey="label" tick={{ fontSize: 8 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${value} cards`, ""]}
          contentStyle={CHART_TOOLTIP_STYLE}
        />
        <Bar dataKey="count" fill="var(--catppuccin-color-rosewater)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </StatChartCard>
  );
}
