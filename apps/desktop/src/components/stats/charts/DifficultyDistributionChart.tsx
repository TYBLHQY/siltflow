import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { computeDifficultyHistogram } from "@siltflow/shared/fsrs";
import { useStatsStore } from "@/stores/stats.store";

export function DifficultyDistributionChart() {
  const parsedCards = useStatsStore((s) => s.parsedCards);
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const loading = useStatsStore((s) => s.loading);

  const data = useMemo(
    () => computeDifficultyHistogram(Array.from(parsedCards.values())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsedCards, dataVersion],
  );

  const isEmpty = data.every((d) => d.count === 0);

  return (
    <ChartCard
      title="Difficulty Distribution"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="No reviewed cards yet"
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 8 }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            formatter={(value: any) => [`${value} cards`, ""]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--tooltip-bg)",
            }}
          />
          <Bar dataKey="count" fill="var(--rosewater)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
