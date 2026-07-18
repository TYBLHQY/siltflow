import { type ReactNode } from "react";
import { CartesianGrid, ResponsiveContainer } from "recharts";
import { ChartCard } from "./ChartCard";

// ── Shared tooltip style (used by every chart's `<Tooltip contentStyle={…} />`) ──
export const CHART_TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid var(--catppuccin-color-overlay0)",
  background: "var(--tooltip-bg)",
} as const;

// ── Shared `<CartesianGrid />` (identical in 10 charts) ─────────────────
export function ChartGrid() {
  return <CartesianGrid strokeDasharray="3 3" className="stroke-ctp-overlay0/50" />;
}

// ── Shared `<ChartCard>` + `<ResponsiveContainer>` wrapper ─────────────
interface StatChartCardProps {
  title: string;
  height?: number;
  loading: boolean;
  isEmpty: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

export function StatChartCard({
  title,
  height = 240,
  loading,
  isEmpty,
  emptyMessage,
  children,
}: StatChartCardProps) {
  return (
    <ChartCard
      title={title}
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage={emptyMessage}
    >
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </ChartCard>
  );
}
