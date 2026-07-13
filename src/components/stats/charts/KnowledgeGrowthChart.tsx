import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { computeKnowledgeGrowth } from "@/lib/stats-computation";
import { useStatsStore } from "@/stores/stats.store";

const GRADIENTS = [
  { id: "gradLearning", color: "var(--rosewater)" },
  { id: "gradYoung", color: "var(--peach)" },
  { id: "gradMature", color: "var(--green)" },
  { id: "gradLongTerm", color: "var(--sapphire)" },
];

export function KnowledgeGrowthChart() {
  const logs = useStatsStore((s) => s.rawReviewLogs);
  const parsedCards = useStatsStore((s) => s.parsedCards);
  const dataVersion = useStatsStore((s) => s.dataVersion);
  const loading = useStatsStore((s) => s.loading);

  const data = useMemo(
    () => computeKnowledgeGrowth(logs, parsedCards),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, parsedCards, dataVersion],
  );

  return (
    <ChartCard
      title="Knowledge Growth"
      loading={loading}
      isEmpty={data.length === 0}
      emptyMessage="No review activity yet"
    >
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <defs>
            {GRADIENTS.map((g) => (
              <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={g.color} stopOpacity={0.85} />
                <stop offset="95%" stopColor={g.color} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={(d: string) => d.slice(5)}
            stroke="var(--text)"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10 }}
            stroke="var(--text)"
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--tooltip-bg)",
            }}
          />
          <Legend verticalAlign="bottom"
            wrapperStyle={{ fontSize: 11 }}
            content={({ payload }) => {
              const colors: Record<string, string> = {
                "Long-term": "var(--sapphire)",
                "Mature": "var(--green)",
                "Young": "var(--peach)",
                "Learning": "var(--rosewater)",
              };
              return (
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
                  {payload?.map((entry) => (
                    <div key={entry.value} className="flex items-center gap-1">
                      <span
                        className="inline-block h-2 w-2 rounded-sm"
                        style={{ backgroundColor: colors[entry.value as string] ?? "var(--text)" }}
                      />
                      <span className="text-foreground">{entry.value}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="longTerm"
            name="Long-term"
            stackId="1"
            stroke="var(--sapphire)"
            fill="url(#gradLongTerm)"
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="mature"
            name="Mature"
            stackId="1"
            stroke="var(--green)"
            fill="url(#gradMature)"
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="young"
            name="Young"
            stackId="1"
            stroke="var(--peach)"
            fill="url(#gradYoung)"
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="learning"
            name="Learning"
            stackId="1"
            stroke="var(--rosewater)"
            fill="url(#gradLearning)"
            fillOpacity={1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
