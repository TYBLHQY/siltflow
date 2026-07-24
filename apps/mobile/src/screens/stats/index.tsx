/**
 * StatsScreen — study statistics dashboard.
 *
 * Uses useStatsStore for data loading and shared-lib for computation.
 * Charts rendered with NativeWind-styled View bars (no SVG dependency).
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { RefreshControl } from "react-native";
import { View, Text, SafeAreaView, ScrollView } from "@/tw";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@/components/ui";
import { useStatsStore } from "@/stores/stats.store";
import {
  STATE_LABEL,
} from "@siltflow/shared-lib";

// ── Grade/State color maps (NativeWind class strings) ──────────────

const GRADE_COLORS: Record<number, string> = {
  1: "bg-ctp-red",
  2: "bg-ctp-peach",
  3: "bg-ctp-green",
  4: "bg-ctp-blue",
};

const STATE_COLORS: Record<number, string> = {
  0: "bg-ctp-sky",
  1: "bg-ctp-yellow",
  2: "bg-ctp-green",
  3: "bg-ctp-red",
};

// ── Chart helpers ──────────────────────────────────────────────────

function BarChart({
  items,
  maxValue,
}: {
  items: { label: string; value: number; color: string }[];
  maxValue: number;
}) {
  return (
    <View className="gap-2">
      {items.map((item, i) => {
        const pct = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 2) : 0;
        return (
          <View key={i} className="gap-1">
            <View className="flex-row justify-between">
              <Text className="text-xs text-ctp-subtext0">{item.label}</Text>
              <Text className="text-xs text-ctp-subtext0">{item.value}</Text>
            </View>
            <View className="h-4 bg-ctp-surface0 rounded-full overflow-hidden">
              <View
                className={`h-full rounded-full ${item.color}`}
                style={{ width: `${pct}%` }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

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
  const getDailyReviews = useStatsStore((s) => s.getDailyReviews);
  const getGradeDistribution = useStatsStore((s) => s.getGradeDistribution);

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // Derive total and newCards the same way desktop OverviewCards.tsx does:
  //   - cards only contains fsrs_cards rows (reviewed annotations).
  //   - annotationCount counts non-highlight annotations.
  //   - newCards = annotations without an fsrs_card row yet.
  //   - total should include unreviewed annotations too.
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

  const dailyReviews = useMemo(() => {
    if (!loaded) return [];
    return getDailyReviews(30);
  }, [loaded, reviewLogs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const gradeDist = useMemo(() => {
    if (!loaded) return [];
    return getGradeDistribution();
  }, [loaded, reviewLogs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // State distribution from cards
  const stateDist = useMemo(() => {
    if (!loaded || cards.length === 0) return [];
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const card of cards) {
      const s = typeof card.state === "number" ? card.state : 0;
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return [0, 1, 2, 3]
      .filter((s) => counts[s] > 0)
      .map((s) => ({ label: STATE_LABEL[s] ?? `State ${s}`, value: counts[s], color: STATE_COLORS[s] ?? "bg-ctp-overlay0" }));
  }, [loaded, cards]);

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

  const maxDaily = Math.max(...dailyReviews.map((d) => d.count), 1);
  const dailyBars = dailyReviews.slice(-14).map((d) => ({
    label: d.date.slice(5), // "MM-DD"
    value: d.count,
    color: "bg-ctp-blue",
  }));

  const maxGrade = Math.max(...gradeDist.map((g) => g.value), 1);
  const gradeBars = gradeDist.map((g) => ({
    label: g.name,
    value: g.value,
    color: GRADE_COLORS[g.name === "Again" ? 1 : g.name === "Hard" ? 2 : g.name === "Good" ? 3 : 4] ?? "bg-ctp-overlay0",
  }));

  const maxState = stateDist.length > 0
    ? Math.max(...stateDist.map((s) => s.value), 1)
    : 1;

  return (
    <SafeAreaView className="flex-1 bg-ctp-base">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Overview cards */}
        {overview && (
          <View className="gap-3">
            {/* Row 1 */}
            <View className="flex-row gap-3">
              <StatCard label="Total Cards" value={total} />
              <StatCard label="Due Today" value={overview.dueToday} color="text-ctp-red" />
              <StatCard label="New Cards" value={newCards} color="text-ctp-blue" />
            </View>
            {/* Row 2 */}
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

        {/* State distribution */}
        {stateDist.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Card States</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart items={stateDist} maxValue={maxState} />
            </CardContent>
          </Card>
        )}

        {/* Daily reviews (last 14 days) */}
        {dailyBars.length > 0 && dailyBars.some((d) => d.value > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart items={dailyBars} maxValue={maxDaily} />
            </CardContent>
          </Card>
        )}

        {/* Grade distribution */}
        {gradeBars.length > 0 && gradeBars.some((g) => g.value > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Grade Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart items={gradeBars} maxValue={maxGrade} />
            </CardContent>
          </Card>
        )}

        {/* Annotation count summary */}
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="flex-row justify-between">
              <Text className="text-sm text-ctp-subtext0">Total Annotations</Text>
              <Text className="text-sm font-semibold text-ctp-text">{annotationCount}</Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-sm text-ctp-subtext0">With FSRS Cards</Text>
              <Text className="text-sm font-semibold text-ctp-text">{cards.length}</Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-sm text-ctp-subtext0">Review Logs</Text>
              <Text className="text-sm font-semibold text-ctp-text">{reviewLogs.length}</Text>
            </View>
          </CardContent>
        </Card>

        {/* Bottom padding for tab bar */}
        <View className="h-16" />
      </ScrollView>
    </SafeAreaView>
  );
}
