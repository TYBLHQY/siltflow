import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { CHART_TOOLTIP_STYLE } from "../ChartPresets";
import { useChartData } from "@/hooks/useChartData";
import { computeGradeDistribution } from "@/lib/stats-computation";

export function RecallRateChart() {
  const { logs, loading } = useChartData();

  const data = useMemo(
    () => computeGradeDistribution(logs),
    [logs],
  );

  const isEmpty = data.every((d) => d.value === 0);

  return (
    <ChartCard
      title="Recall Rate" loading={loading} isEmpty={isEmpty} emptyMessage="No reviews yet"
    >
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data} cx="50%" cy="50%"
            innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
