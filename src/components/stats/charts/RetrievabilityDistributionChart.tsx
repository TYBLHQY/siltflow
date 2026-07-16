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
import { computeRetrievabilityHistogram, computeOverviewStats } from "@/lib/stats-computation";
import { useStatsStore } from "@/stores/stats.store";

export function RetrievabilityDistributionChart() {
  const parsedCards = useStatsStore((s) => s.parsedCards);
  const rawReviewLogs = useStatsStore((s) => s.rawReviewLogs);
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const loading = useStatsStore((s) => s.loading);

  const cards = useMemo(() => Array.from(parsedCards.values()), [parsedCards, dataVersion]);

  const data = useMemo(
    () => computeRetrievabilityHistogram(cards),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, dataVersion],
  );

  const overview = useMemo(
    () => computeOverviewStats(cards, rawReviewLogs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, rawReviewLogs, dataVersion],
  );

  const isEmpty = data.every((d) => d.count === 0);

  return (
    <ChartCard
      title="Retrievability Distribution"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="No reviewed cards yet"
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-ctp-overlay0/50" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9 }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--catppuccin-color-overlay0)",
              background: "var(--tooltip-bg)",
            }}
          />
          <ReferenceLine
            x={Math.min(Math.floor(overview.avgRetrievability * 10), 9)}
            strokeDasharray="3 3"
            label={{
              value: "avg",
              position: "top",
              fontSize: 10,
              fill: "var(--catppuccin-color-red)",
            }}
          />
          <Bar dataKey="count" fill="var(--catppuccin-color-maroon)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
