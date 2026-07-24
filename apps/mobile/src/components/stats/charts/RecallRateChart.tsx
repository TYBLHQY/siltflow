/**
 * RecallRateChart — grade distribution as a stacked bar + legend.
 *
 * Mirrors desktop RecallRateChart.tsx (donut chart), but uses a
 * horizontal stacked bar instead — React Native has no SVG support,
 * and a View-based donut arc is fragile across platforms.
 *
 * Data: useStatsStore().getGradeDistribution()
 */

import { useMemo } from "react";
import { View, Text } from "@/tw";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { useStatsStore } from "@/stores/stats.store";

// ── Grade constants ───────────────────────────────────────────────

const GRADE_HEX: Record<string, string> = {
  Again: "#e78284",
  Hard: "#ef9f76",
  Good: "#a6d189",
  Easy: "#8caaee",
};

const GRADE_CLASS: Record<string, string> = {
  Again: "bg-ctp-red",
  Hard: "bg-ctp-peach",
  Good: "bg-ctp-green",
  Easy: "bg-ctp-blue",
};

// ── Component ──────────────────────────────────────────────────────

export function RecallRateChart() {
  const getGradeDistribution = useStatsStore((s) => s.getGradeDistribution);
  const reviewLogs = useStatsStore((s) => s.reviewLogs);
  const loaded = useStatsStore((s) => s.loaded);

  const gradeDist = useMemo(
    () => getGradeDistribution(),
    [getGradeDistribution, reviewLogs.length], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const total = useMemo(
    () => gradeDist.reduce((s, d) => s + d.value, 0),
    [gradeDist],
  );

  const isEmpty = !loaded || total === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recall Rate</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <View className="py-8 items-center">
            <Text className="text-xs text-ctp-subtext0">No reviews yet</Text>
          </View>
        ) : (
          <View className="gap-4">
            {/* Total count */}
            <View className="items-center">
              <Text className="text-2xl font-bold text-ctp-text">{total}</Text>
              <Text className="text-xs text-ctp-subtext0">total reviews</Text>
            </View>

            {/* Horizontal stacked bar */}
            <View className="h-6 bg-ctp-surface0 rounded-full overflow-hidden flex-row">
              {gradeDist.map((d) => {
                const pct = total > 0 ? (d.value / total) * 100 : 0;
                if (pct <= 0) return null;
                const cls = GRADE_CLASS[d.name] ?? "bg-ctp-overlay0";
                return (
                  <View
                    key={d.name}
                    className={`h-full ${cls}`}
                    style={{ width: `${pct}%` }}
                  />
                );
              })}
            </View>

            {/* Legend */}
            <View className="flex-row flex-wrap justify-center gap-x-5 gap-y-1.5">
              {gradeDist.map((d) => {
                const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0";
                const hex = GRADE_HEX[d.name] ?? "#888";
                return (
                  <View key={d.name} className="flex-row items-center gap-1.5">
                    <View
                      className="rounded-full"
                      style={{ width: 10, height: 10, backgroundColor: hex }}
                    />
                    <Text className="text-xs text-ctp-subtext0">
                      {d.name} {d.value} ({pct}%)
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </CardContent>
    </Card>
  );
}
