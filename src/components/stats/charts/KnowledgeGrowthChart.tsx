import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { ChartGrid, CHART_TOOLTIP_STYLE } from "../ChartPresets";
import { useChartData } from "@/hooks/useChartData";
import { computeKnowledgeGrowth } from "@/lib/stats-computation";

const GRADIENTS = [
  { id: "gradLearning", color: "var(--catppuccin-color-rosewater)" },
  { id: "gradYoung", color: "var(--catppuccin-color-peach)" },
  { id: "gradMature", color: "var(--catppuccin-color-green)" },
  { id: "gradLongTerm", color: "var(--catppuccin-color-sapphire)" },
];

export function KnowledgeGrowthChart() {
  const { logs, cards, loading } = useChartData();

  const data = useMemo(
    () => computeKnowledgeGrowth(logs, new Map(cards.map((c, i) => [String(i), c]))),
    [logs, cards],
  );

  const isEmpty = data.length === 0;

  return (
    <ChartCard title="Knowledge Growth" loading={loading} isEmpty={isEmpty} emptyMessage="No review activity yet">
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
          <ChartGrid />
          <XAxis dataKey="date" tick={{ fontSize: 10 }}
            tickFormatter={(d: string) => d.slice(5)} stroke="var(--catppuccin-color-text)" />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="var(--catppuccin-color-text)" />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }}
            content={({ payload }) => {
              const colors: Record<string, string> = {
                "Long-term": "var(--catppuccin-color-sapphire)", "Mature": "var(--catppuccin-color-green)",
                "Young": "var(--catppuccin-color-peach)", "Learning": "var(--catppuccin-color-rosewater)",
              };
              return (
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
                  {payload?.map((entry) => (
                    <div key={entry.value} className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm"
                        style={{ backgroundColor: colors[entry.value as string] ?? "var(--catppuccin-color-text)" }} />
                      <span className="text-ctp-text">{entry.value}</span>
                    </div>
                  ))}
                </div>
              );
            }} />
          <Area type="monotone" dataKey="longTerm" name="Long-term" stackId="1"
            stroke="var(--catppuccin-color-sapphire)" fill="url(#gradLongTerm)" fillOpacity={1} />
          <Area type="monotone" dataKey="mature" name="Mature" stackId="1"
            stroke="var(--catppuccin-color-green)" fill="url(#gradMature)" fillOpacity={1} />
          <Area type="monotone" dataKey="young" name="Young" stackId="1"
            stroke="var(--catppuccin-color-peach)" fill="url(#gradYoung)" fillOpacity={1} />
          <Area type="monotone" dataKey="learning" name="Learning" stackId="1"
            stroke="var(--catppuccin-color-rosewater)" fill="url(#gradLearning)" fillOpacity={1} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
