/**
 * ReviewForecastChart — bar chart showing upcoming due cards.
 *
 * Mirrors desktop ReviewForecastChart.tsx.
 * Data: useStatsStore().getReviewForecast(14)
 */

import { useMemo } from "react";
import { View, Text } from "@/tw";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { useStatsStore } from "@/stores/stats.store";

export function ReviewForecastChart() {
  const getReviewForecast = useStatsStore((s) => s.getReviewForecast);
  const cards = useStatsStore((s) => s.cards);
  const loaded = useStatsStore((s) => s.loaded);

  const data = useMemo(
    () => getReviewForecast(14),
    [getReviewForecast, cards.length], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const maxValue = useMemo(
    () => Math.max(...data.map((d) => d.dueCount), 1),
    [data],
  );

  const isEmpty = !loaded || data.every((d) => d.dueCount === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <View className="py-8 items-center">
            <Text className="text-xs text-ctp-subtext0">No cards due soon</Text>
          </View>
        ) : (
          <View className="gap-1">
            {data.map((d) => {
              const pct = maxValue > 0 ? Math.max((d.dueCount / maxValue) * 100, 0) : 0;
              return (
                <View key={d.date} className="flex-row items-center gap-1.5">
                  <Text className="text-[9px] text-ctp-subtext0 w-10 text-right">
                    {d.date.slice(5)}
                  </Text>
                  <View className="flex-1 h-4 bg-ctp-surface0 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full bg-ctp-green"
                      style={{ width: `${Math.max(pct, d.dueCount > 0 ? 2 : 0)}%` }}
                    />
                  </View>
                  <Text className="text-[10px] text-ctp-subtext0 w-5 text-right">
                    {d.dueCount}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </CardContent>
    </Card>
  );
}
