import {
  BrainCircuit,
  Bell,
  Sparkles,
  BookOpen,
  Target,
  Calendar,
} from "lucide-react";
import { computeOverviewStats } from "@/lib/stats-computation";
import { useStatsStore } from "@/stores/stats.store";

interface StatCardData {
  icon: typeof BrainCircuit;
  label: string;
  value: string | number;
  color: string;
}

function StatCard({ icon: Icon, label, value, color }: StatCardData) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-white dark:bg-mantle shadow-sm px-4 py-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: color + "20" }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight tracking-tight">
          {value ?? "—"}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}

function formatPct(n: number): string {
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—";
}

function formatFloat(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

export function OverviewCards() {
  const rawCards = useStatsStore((s) => s.rawCards);
  const rawReviewLogs = useStatsStore((s) => s.rawReviewLogs);
  const parsedCards = useStatsStore((s) => s.parsedCards);
  const loading = useStatsStore((s) => s.loading);

  // Memoised via dataVersion
  if (loading || !rawCards.length) {
    return (
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-border/80 bg-white dark:bg-mantle shadow-sm px-4 py-3"
          >
            <div className="mb-2 h-9 w-9 rounded-full bg-muted" />
            <div className="mb-1 h-5 w-16 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const cards = Array.from(parsedCards.values());
  const logs = rawReviewLogs;
  const stats = computeOverviewStats(cards, logs);

  const items: StatCardData[] = [
    {
      icon: BrainCircuit,
      label: "Total cards",
      value: formatNum(stats.total),
      color: "var(--mauve)",
    },
    {
      icon: Bell,
      label: "Due today",
      value: formatNum(stats.dueToday),
      color: "var(--red)",
    },
    {
      icon: Sparkles,
      label: "New cards",
      value: formatNum(stats.newCards),
      color: "var(--blue)",
    },
    {
      icon: BookOpen,
      label: "Learning",
      value: formatNum(stats.learning),
      color: "var(--yellow)",
    },
    {
      icon: Target,
      label: "Retrievability",
      value: formatPct(stats.avgRetrievability),
      color: "var(--green)",
    },
    {
      icon: Calendar,
      label: "Avg stability",
      value: formatFloat(stats.avgStability) + "d",
      color: "var(--teal)",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
      {items.map((item) => (
        <StatCard key={item.label} {...item} />
      ))}
    </div>
  );
}
