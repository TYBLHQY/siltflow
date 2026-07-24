/**
 * ReviewScreen — document list showing per-document review urgency.
 *
 * Uses getDocMetrics() from review-metrics.service to compute
 * due/new/due-soon counts and composite urgency score for each
 * document that has annotations with FSRS cards.
 *
 * Tapping a document opens the ReviewSession for that document.
 *
 * Sort buttons are pinned at the top (mirrors desktop review-tab.tsx).
 * Uses FlatList for virtualized rendering — only visible items are
 * mounted, keeping the JS thread and native renderer fast even with
 * hundreds of documents.
 */

import { useState, useCallback, useMemo } from "react";
import { FlatList, RefreshControl } from "react-native";
import { View, Text, Pressable, SafeAreaView, ScrollView } from "@/tw";
import { Card, CardContent, Badge, Spinner, EmptyState } from "@/components/ui";
import { useRouter, useFocusEffect } from "expo-router";
import { getSQLite } from "@/stores/db.store";
import { getDocMetrics, type MetricsRow } from "@/services/review-metrics.service";

// ── Sort (mirrors desktop lib/doc-review.ts) ──────────────────────────

type SortField = "new" | "due" | "soon" | "urgency";

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: "new", label: "New" },
  { field: "due", label: "Due" },
  { field: "soon", label: "Soon" },
  { field: "urgency", label: "Urgency" },
];

/**
 * Multi-level tiebreaker sort. Each dimension chains into the next
 * most relevant signal so documents with equal primary values still
 * have a meaningful order.
 *
 * Final tiebreaker compares documentTitle with simple string comparison
 * (not localeCompare — avoids Android Hermes ICU Collator OOM).
 */
function sortMetrics(metrics: MetricsRow[], field: SortField): MetricsRow[] {
  const sorted = [...metrics];

  const chains: Record<SortField, Array<(a: MetricsRow, b: MetricsRow) => number>> = {
    new: [
      (a, b) => b.newCardsCount - a.newCardsCount,
      (a, b) => b.dueNowCount - a.dueNowCount,
      (a, b) => b.dueSoonCount - a.dueSoonCount,
      (a, b) => a.avgRetrievability - b.avgRetrievability,
    ],
    due: [
      (a, b) => b.dueNowCount - a.dueNowCount,
      (a, b) => b.newCardsCount - a.newCardsCount,
      (a, b) => b.avgOverdueRatio - a.avgOverdueRatio,
      (a, b) => b.dueSoonCount - a.dueSoonCount,
      (a, b) => a.avgRetrievability - b.avgRetrievability,
    ],
    soon: [
      (a, b) => b.dueSoonCount - a.dueSoonCount,
      (a, b) => b.dueNowCount - a.dueNowCount,
      (a, b) => b.newCardsCount - a.newCardsCount,
      (a, b) => b.avgOverdueRatio - a.avgOverdueRatio,
      (a, b) => a.avgRetrievability - b.avgRetrievability,
    ],
    urgency: [
      (a, b) => b.compositeScore - a.compositeScore,
      (a, b) => b.dueNowCount - a.dueNowCount,
      (a, b) => b.newCardsCount - a.newCardsCount,
      (a, b) => b.dueSoonCount - a.dueSoonCount,
      (a, b) => b.avgOverdueRatio - a.avgOverdueRatio,
      (a, b) => a.avgRetrievability - b.avgRetrievability,
    ],
  };

  const comparators = chains[field];
  const titleCmp = (a: MetricsRow, b: MetricsRow) =>
    a.documentTitle < b.documentTitle ? -1
    : a.documentTitle > b.documentTitle ? 1
    : 0;

  sorted.sort((a, b) => {
    for (const cmp of comparators) {
      const d = cmp(a, b);
      if (d !== 0) return d;
    }
    return titleCmp(a, b);
  });

  return sorted;
}

// ── Retrievability label (mirrors desktop fsrs-utils.ts) ──────────────

function retrievabilityLabel(r: number): string {
  if (r >= 90) return "fresh";
  if (r >= 75) return "ok";
  if (r >= 50) return "due";
  return "overdue";
}

// ── Component ─────────────────────────────────────────────────────────

export function ReviewScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricsRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState<SortField>("urgency");

  const loadMetrics = useCallback(() => {
    try {
      const sql = getSQLite();
      const data = getDocMetrics(sql);
      setMetrics(data);
    } catch (err) {
      console.error("[ReviewScreen] loadMetrics failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload metrics each time the screen is focused
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadMetrics();
    }, [loadMetrics]),
  );

  const sortedMetrics = useMemo(
    () => (metrics ? sortMetrics(metrics, sortField) : null),
    [metrics, sortField],
  );

  const handleOpenSession = useCallback(
    (doc: MetricsRow) => {
      router.push(
        `/review-session?documentId=${encodeURIComponent(doc.documentId)}&documentTitle=${encodeURIComponent(doc.documentTitle)}`,
      );
    },
    [router],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMetrics();
  }, [loadMetrics]);

  // ── Render: Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-ctp-base">
        <View className="flex-1 items-center justify-center gap-4">
          <Spinner size="lg" label="Loading review data..." />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Empty ─────────────────────────────────────────────────

  if (!metrics || metrics.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-ctp-base">
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <EmptyState
            title="Nothing to review yet"
            description="Create annotations on your documents to start reviewing with spaced repetition."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: Sort buttons + list ───────────────────────────────────

  const renderSortBar = () => (
    <View className="flex-row gap-0.5 px-2 py-1.5 border-b border-ctp-surface0">
      {SORT_OPTIONS.map(({ field, label }) => {
        const active = sortField === field;
        return (
          <Pressable
            key={field}
            onPress={() => setSortField(field)}
            className={`flex-1 items-center rounded px-1 py-1 ${
              active ? "bg-ctp-blue" : "bg-transparent"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                active ? "text-ctp-crust" : "text-ctp-subtext0"
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderItem = ({ item: doc }: { item: MetricsRow }) => (
    <View className="px-4 pb-3">
      <Pressable onPress={() => handleOpenSession(doc)}>
        <Card>
          <CardContent>
            {/* Doc title */}
            <Text className="text-base font-semibold text-ctp-text" numberOfLines={1}>
              {doc.documentTitle}
            </Text>

            {/* Four badges row (mirrors desktop review-tab.tsx) */}
            {doc.totalCards > 0 && (
              <View className="flex-row flex-wrap gap-1.5 mt-1.5">
                <Badge variant="default">{doc.newCardsCount} new</Badge>
                <Badge variant="destructive">{doc.dueNowCount} due</Badge>
                <Badge variant="peach">{doc.dueSoonCount} soon</Badge>
                <Badge variant="mauve">{retrievabilityLabel(doc.avgRetrievability)}</Badge>
              </View>
            )}
          </CardContent>
        </Card>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-ctp-base">
      <FlatList
        data={sortedMetrics}
        keyExtractor={(doc) => doc.documentId}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {renderSortBar()}
            <View className="pt-3" />
          </>
        }
        ListFooterComponent={<View className="h-16" />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        stickyHeaderIndices={[0]}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={true}
      />
    </SafeAreaView>
  );
}
