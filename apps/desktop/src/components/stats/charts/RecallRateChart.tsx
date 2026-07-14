import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { computeGradeDistribution } from "@siltflow/shared/fsrs";
import { useStatsStore } from "@/stores/stats.store";

export function RecallRateChart() {
  const logs = useStatsStore((s) => s.rawReviewLogs);
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const loading = useStatsStore((s) => s.loading);

  const data = useMemo(
    () => computeGradeDistribution(logs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, dataVersion],
  );

  const total = data.reduce((s, d) => s + d.value, 0);
  const isEmpty = total === 0;

  return (
    <ChartCard
      title="Recall Rate"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="No reviews yet"
    >
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(_value: any, _name: any) => {
              const item = data.find((d) => d.name === _name);
              const pct = total > 0 ? ((item?.value ?? 0) / total * 100).toFixed(1) : "0.0";
              return [`${item?.value} (${pct}%)`, _name as string];
            }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--tooltip-bg)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
