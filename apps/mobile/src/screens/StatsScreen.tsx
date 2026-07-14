import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStatsStore } from "../stores/stats.store";
import { computeOverviewStats, computeDailyReviews } from "@siltflow/shared/fsrs";

export default function StatsScreen() {
  const loaded = useStatsStore((s) => s.loaded);
  const loading = useStatsStore((s) => s.loading);
  const rawReviewLogs = useStatsStore((s) => s.rawReviewLogs);
  const parsedCards = useStatsStore((s) => s.parsedCards);
  const loadAllData = useStatsStore.getState().loadAllData;
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loaded) loadAllData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const overview = loaded
    ? computeOverviewStats(
        Array.from(parsedCards.values()),
        rawReviewLogs.map((r) => ({ data: r.data })),
      )
    : null;

  const daily = loaded
    ? computeDailyReviews(
        rawReviewLogs.map((r) => ({ createdAt: r.createdAt, data: r.data })),
        7,
      )
    : [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scroll}
      >
        {overview ? (
          <>
            <View style={styles.grid}>
              <StatCard label="Total Cards" value={overview.total.toString()} />
              <StatCard label="Due Today" value={overview.dueToday.toString()} />
              <StatCard label="Learning" value={overview.learning.toString()} />
              <StatCard label="Review" value={overview.review.toString()} />
            </View>
            <View style={styles.grid}>
              <StatCard
                label="Avg Stability"
                value={`${overview.avgStability.toFixed(1)}d`}
              />
              <StatCard
                label="Avg Difficulty"
                value={overview.avgDifficulty.toFixed(2)}
              />
              <StatCard
                label="Avg Retrievability"
                value={`${(overview.avgRetrievability * 100).toFixed(0)}%`}
              />
            </View>

            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {daily.length > 0 ? (
              daily.map((d) => (
                <View key={d.date} style={styles.dailyRow}>
                  <Text style={styles.dailyDate}>{d.date}</Text>
                  <Text style={styles.dailyCount}>
                    {d.count} review{d.count !== 1 ? "s" : ""}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.hint}>No reviews yet.</Text>
            )}
          </>
        ) : (
          <Text style={styles.hint}>Loading statistics…</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  scroll: { padding: 16 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "700", color: "#333" },
  statLabel: { fontSize: 12, color: "#888", marginTop: 2 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 8,
  },
  dailyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
  },
  dailyDate: { fontSize: 14, color: "#555" },
  dailyCount: { fontSize: 14, color: "#333", fontWeight: "600" },
  hint: { fontSize: 14, color: "#999", textAlign: "center", marginTop: 20 },
});
