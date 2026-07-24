/**
 * StatsScreen — study statistics dashboard (mobile).
 *
 * Renders 4 chart cards via NativeWind View-based components
 * (no SVG / Recharts dependency — React Native compatible):
 *   - DailyReviewsChart  (stacked bar + time toggle)
 *   - CalendarHeatmap     (GitHub-style year grid)
 *   - ReviewForecastChart (upcoming 14-day bar)
 *   - RecallRateChart     (grade distribution stacked bar)
 *
 * Also keeps the overview stat-cards row from the original layout.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { RefreshControl } from "react-native";
import { View, Text, SafeAreaView, ScrollView } from "@/tw";
import { Spinner } from "@/components/ui";
import { useStatsStore } from "@/stores/stats.store";
import { DailyReviewsChart } from "@/components/stats/charts/DailyReviewsChart";
import { CalendarHeatmap } from "@/components/stats/charts/CalendarHeatmap";
import { ReviewForecastChart } from "@/components/stats/charts/ReviewForecastChart";
import { RecallRateChart } from "@/components/stats/charts/RecallRateChart";

// ── Stat card ─────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <View className="flex-1 bg-ctp-surface0 rounded-lg p-3 items-center">
      <Text className={`text-2xl font-bold ${color ?? "text-ctp-text"}`}>
        {value}
      </Text>
      <Text className="text-xs text-ctp-subtext0 mt-1 text-center">{label}</Text>
    </View>
  );
}

// ── Component ──────────────────────────────────────────────────────

export function StatsScreen() {
  const cards = useStatsStore((s) => s.cards);
  const reviewLogs = useStatsStore((s) => s.reviewLogs);
  const annotationCount = useStatsStore((s) => s.annotationCount);
  const loaded = useStatsStore((s) => s.loaded);
  const loading = useStatsStore((s) => s.loading);
  const loadFromDb = useStatsStore((s) => s.loadFromDb);
  const refresh = useStatsStore((s) => s.refresh);
  const getOverview = useStatsStore((s) => s.getOverview);

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    // refresh() already sets loading=true; once store updates,
    // loaded will switch and the loading spinner disappears.
    setRefreshing(false);
  }, [refresh]);

  const newCards = useMemo(() => {
    if (!loaded) return 0;
    return Math.max(0, annotationCount - cards.length);
  }, [loaded, annotationCount, cards.length]);

  const total = useMemo(() => {
    return Math.max(annotationCount, cards.length);
  }, [annotationCount, cards.length]);

  const overview = useMemo(() => {
    if (!loaded) return null;
    return getOverview();
  }, [loaded, cards.length, reviewLogs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render: Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-ctp-base">
        <View className="flex-1 items-center justify-center gap-4">
          <Spinner size="lg" label="Loading statistics..." />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Empty ─────────────────────────────────────────────────

  if (!loaded || (cards.length === 0 && reviewLogs.length === 0)) {
    return (
      <SafeAreaView className="flex-1 bg-ctp-base">
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-1 items-center justify-center px-8 gap-4"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Text className="text-5xl">📊</Text>
          <Text className="text-xl font-bold text-ctp-text">No Stats Yet</Text>
          <Text className="text-ctp-subtext0 text-center">
            Start reviewing annotations to see your study statistics here.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: Dashboard ────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-ctp-base">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ── Overview cards ─────────────────────────────────────────── */}
        {overview && (
          <View className="gap-3">
            <View className="flex-row gap-3">
              <StatCard label="Total Cards" value={total} />
              <StatCard label="Due Today" value={overview.dueToday} color="text-ctp-red" />
              <StatCard label="New Cards" value={newCards} color="text-ctp-blue" />
            </View>
            <View className="flex-row gap-3">
              <StatCard label="Learning" value={overview.learning} color="text-ctp-yellow" />
              <StatCard
                label="Retrievability"
                value={`${Math.round(overview.avgRetrievability * 100)}%`}
                color="text-ctp-green"
              />
              <StatCard
                label="Avg Stability"
                value={`${overview.avgStability.toFixed(1)}d`}
                color="text-ctp-teal"
              />
            </View>
          </View>
        )}

        {/* ── Charts ────────────────────────────────────────────────── */}
        <DailyReviewsChart />
        <CalendarHeatmap />
        <ReviewForecastChart />
        <RecallRateChart />

        {/* Bottom padding for tab bar */}
        <View className="h-16" />
      </ScrollView>
    </SafeAreaView>
  );
}
