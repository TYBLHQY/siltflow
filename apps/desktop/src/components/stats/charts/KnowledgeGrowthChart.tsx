import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { ChartGrid, CHART_TOOLTIP_STYLE } from "../ChartPresets";
import { useChartData } from "@/hooks/useChartData";
import { computeKnowledgeGrowth } from "@/lib/stats-computation";

const GRADIENTS = [
  { id: "gradLearning", color: "var(--catppuccin-color-red)" },
  { id: "gradYoung", color: "var(--catppuccin-color-yellow)" },
  { id: "gradMature", color: "var(--catppuccin-color-green)" },
  { id: "gradLongTerm", color: "var(--catppuccin-color-blue)" },
];

// Maturity order for Legend and Tooltip — bottom-to-top: Learning → Long-term.
const MATURITY_ORDER: Record<string, number> = {
  "Learning": 0,
  "Young": 1,
  "Mature": 2,
  "Long-term": 3,
};

const LEGEND_COLORS: Record<string, string> = {
  "Learning": "var(--catppuccin-color-red)",
  "Young": "var(--catppuccin-color-yellow)",
  "Mature": "var(--catppuccin-color-green)",
  "Long-term": "var(--catppuccin-color-blue)",
};

export function KnowledgeGrowthChart() {
  const { logs, loading } = useChartData();

  const data = useMemo(
    () => computeKnowledgeGrowth(logs),
    [logs],
  );

  const isEmpty = data.length === 0;

  return (
    <ChartCard title="Memory Growth" loading={loading} isEmpty={isEmpty} emptyMessage="No review activity yet">
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
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            itemSorter={(item: any) => MATURITY_ORDER[item.name as string] ?? 99}
          />
          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }}
            content={({ payload }) => {
              const sorted = payload ? [...payload].sort(
                (a, b) => (MATURITY_ORDER[a.value as string] ?? 99) - (MATURITY_ORDER[b.value as string] ?? 99)
              ) : [];
              return (
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
                  {sorted.map((entry) => (
                    <div key={entry.value} className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm"
                        style={{ backgroundColor: LEGEND_COLORS[entry.value as string] ?? "var(--catppuccin-color-text)" }} />
                      <span className="text-ctp-text">{entry.value}</span>
                    </div>
                  ))}
                </div>
              );
            }} />
          <Area type="monotone" dataKey="learning" name="Learning" stackId="1"
            stroke="var(--catppuccin-color-red)" fill="url(#gradLearning)" fillOpacity={1} />
          <Area type="monotone" dataKey="young" name="Young" stackId="1"
            stroke="var(--catppuccin-color-yellow)" fill="url(#gradYoung)" fillOpacity={1} />
          <Area type="monotone" dataKey="mature" name="Mature" stackId="1"
            stroke="var(--catppuccin-color-green)" fill="url(#gradMature)" fillOpacity={1} />
          <Area type="monotone" dataKey="longTerm" name="Long-term" stackId="1"
            stroke="var(--catppuccin-color-blue)" fill="url(#gradLongTerm)" fillOpacity={1} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
