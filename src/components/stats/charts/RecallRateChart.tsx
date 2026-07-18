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

  const total = data.reduce((s, d) => s + d.value, 0);
  const isEmpty = total === 0;

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
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(_value: any, _name: any) => {
              const item = data.find((d) => d.name === _name);
              const pct = total > 0 ? ((item?.value ?? 0) / total * 100).toFixed(1) : "0.0";
              return [`${item?.value} (${pct}%)`, _name as string];
            }}
            contentStyle={CHART_TOOLTIP_STYLE}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
