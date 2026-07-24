/**
 * DailyReviewsChart — stacked bar chart with time-range toggle.
 *
 * Mirrors desktop DailyReviewsChart.tsx but uses NativeWind View bars
 * instead of Recharts (no SVG DOM in React Native).
 *
 * Data: useStatsStore().getDailyReviews(days)
 */

import { useMemo, useState } from "react";
import { View, Text, Pressable } from "@/tw";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { useStatsStore } from "@/stores/stats.store";

const TIME_RANGES = [
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "All", days: 0 },
] as const;

export function DailyReviewsChart() {
  const getDailyReviews = useStatsStore((s) => s.getDailyReviews);
  const reviewLogs = useStatsStore((s) => s.reviewLogs);
  const loaded = useStatsStore((s) => s.loaded);

  const [range, setRange] = useState<(typeof TIME_RANGES)[number]>(TIME_RANGES[0]);

  const data = useMemo(
    () => getDailyReviews(range.days || undefined),
    [getDailyReviews, reviewLogs.length, range.days], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const maxValue = useMemo(
    () => Math.max(...data.map((d) => d.learnCount + d.reviewCount), 1),
    [data],
  );

  const isEmpty = !loaded || data.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Reviews</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <View className="py-8 items-center">
            <Text className="text-xs text-ctp-subtext0">No reviews yet</Text>
          </View>
        ) : (
          <>
            {/* Stacked bar chart */}
            <View className="gap-1">
              {data.map((d) => {
                const totalPct = maxValue > 0 ? ((d.learnCount + d.reviewCount) / maxValue) * 100 : 0;
                const learnPct = (d.learnCount + d.reviewCount) > 0
                  ? Math.max((d.learnCount / (d.learnCount + d.reviewCount)) * totalPct, 0)
                  : 0;
                const reviewPct = totalPct - learnPct;

                return (
                  <View key={d.date} className="flex-row items-center gap-1.5">
                    <Text className="text-[9px] text-ctp-subtext0 w-8 text-right">
                      {d.date.slice(5)}
                    </Text>
                    <View className="flex-1 h-3.5 bg-ctp-surface0 rounded-full overflow-hidden flex-row">
                      {learnPct > 0 && (
                        <View
                          className="h-full bg-ctp-sky"
                          style={{ width: `${learnPct}%` }}
                        />
                      )}
                      {reviewPct > 0 && (
                        <View
                          className="h-full bg-ctp-mauve"
                          style={{ width: `${reviewPct}%` }}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Legend */}
            <View className="flex-row justify-center gap-6 mt-3">
              <View className="flex-row items-center gap-1.5">
                <View className="w-2.5 h-2.5 rounded-full bg-ctp-sky" />
                <Text className="text-xs text-ctp-subtext0">Learning</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <View className="w-2.5 h-2.5 rounded-full bg-ctp-mauve" />
                <Text className="text-xs text-ctp-subtext0">Review</Text>
              </View>
            </View>

            {/* Time range toggle */}
            <View className="flex-row justify-center gap-1.5 mt-2">
              {TIME_RANGES.map((r) => (
                <Pressable
                  key={r.label}
                  onPress={() => setRange(r)}
                  className={`px-2.5 py-0.5 rounded-full ${
                    range.days === r.days ? "bg-ctp-mauve" : "bg-ctp-surface0"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      range.days === r.days ? "text-ctp-base" : "text-ctp-subtext0"
                    }`}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </CardContent>
    </Card>
  );
}
