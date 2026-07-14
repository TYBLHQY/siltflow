import { useEffect, useState } from "react";
import { useStatsStore } from "../stores/stats.store";
import { BarChart3 } from "lucide-react";

export default function StatsScreen() {
  const loaded = useStatsStore((s) => s.loaded);
  const loading = useStatsStore((s) => s.loading);
  const error = useStatsStore((s) => s.error);
  const rawCards = useStatsStore((s) => s.rawCards);
  const rawReviewLogs = useStatsStore((s) => s.rawReviewLogs);
  const loadAllData = useStatsStore((s) => s.loadAllData);

  useEffect(() => {
    if (!loaded) loadAllData();
  }, [loaded, loadAllData]);

  if (loading && !loaded) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold text-foreground mb-4">Statistics</h1>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold text-foreground mb-4">Statistics</h1>
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      </div>
    );
  }

  // Compute basic stats
  const totalCards = rawCards.length;
  const totalReviews = rawReviewLogs.length;

  return (
    <div className="p-4 pb-2">
      <h1 className="text-lg font-semibold text-foreground mb-4">Statistics</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Cards" value={totalCards} />
        <StatCard label="Total Reviews" value={totalReviews} />
        <StatCard label="Cards Studying" value={rawCards.filter((c) => {
          try {
            const card = JSON.parse(c.data);
            return card.state === 2 || card.state === 1;
          } catch { return false; }
        }).length} />
        <StatCard label="Cards Learned" value={rawCards.filter((c) => {
          try {
            const card = JSON.parse(c.data);
            return card.state === 3;
          } catch { return false; }
        }).length} />
      </div>

      {totalCards === 0 && (
        <div className="text-center py-8 mt-4">
          <BarChart3 className="size-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No data yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Study some cards to see statistics
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
