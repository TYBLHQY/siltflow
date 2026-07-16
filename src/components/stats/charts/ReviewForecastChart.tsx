import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { computeReviewForecast } from "@/lib/stats-computation";
import { useStatsStore } from "@/stores/stats.store";

export function ReviewForecastChart() {
  const parsedCards = useStatsStore((s) => s.parsedCards);
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const loading = useStatsStore((s) => s.loading);

  const data = useMemo(
    () => computeReviewForecast(Array.from(parsedCards.values()), 14),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsedCards, dataVersion],
  );

  const isEmpty = data.every((d) => d.dueCount === 0);

  return (
    <ChartCard
      title="Review Forecast (14 days)"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="No cards due soon"
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-ctp-overlay0/50" />
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [`${value} due`, ""]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--catppuccin-color-overlay0)",
              background: "var(--tooltip-bg)",
            }}
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
          <Bar dataKey="dueCount" fill="var(--catppuccin-color-green)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
