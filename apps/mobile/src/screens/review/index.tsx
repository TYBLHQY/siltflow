/**
 * ReviewScreen — document list showing per-document review urgency.
 *
 * Uses getDocMetrics() from review-metrics.service to compute
 * due/new/due-soon counts and composite urgency score for each
 * document that has annotations with FSRS cards.
 *
 * Tapping a document opens the ReviewSession for that document.
 *
 * Uses FlatList for virtualized rendering — only visible items
 * are mounted, keeping the JS thread and native renderer fast
 * even with hundreds of documents.
 */

import { useState, useCallback, useMemo } from "react";
import { FlatList, RefreshControl } from "react-native";
import { View, Text, Pressable, SafeAreaView, ScrollView } from "@/tw";
import { Card, CardContent, Badge, Spinner, EmptyState } from "@/components/ui";
import { useRouter, useFocusEffect } from "expo-router";
import { getSQLite } from "@/stores/db.store";
import { getDocMetrics, type MetricsRow } from "@/services/review-metrics.service";

export function ReviewScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricsRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  // Reload metrics each time the screen is focused (in case we just finished a session)
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadMetrics();
    }, [loadMetrics]),
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

  // Pre-compute summary counts (stable arrays, computed only when metrics change)
  const totalCards = useMemo(
    () => (metrics ? metrics.reduce((sum, m) => sum + m.totalCards, 0) : 0),
    [metrics],
  );
  const totalDueNow = useMemo(
    () => (metrics ? metrics.reduce((sum, m) => sum + m.dueNowCount, 0) : 0),
    [metrics],
  );

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

  // ── Render: Metrics list (FlatList) ───────────────────────────────

  const renderHeader = () => (
    <View className="px-4 pt-4 gap-3">
      <Text className="text-2xl font-bold text-ctp-text px-1 mb-2">
        Review
      </Text>

      {/* Summary row */}
      <View className="flex-row gap-3 mb-2 px-1">
        <View className="flex-1 bg-ctp-surface0 rounded-lg p-3 items-center">
          <Text className="text-xs text-ctp-subtext0">Documents</Text>
          <Text className="text-xl font-bold text-ctp-text">{metrics.length}</Text>
        </View>
        <View className="flex-1 bg-ctp-surface0 rounded-lg p-3 items-center">
          <Text className="text-xs text-ctp-subtext0">Total Cards</Text>
          <Text className="text-xl font-bold text-ctp-text">{totalCards}</Text>
        </View>
        <View className="flex-1 bg-ctp-surface0 rounded-lg p-3 items-center">
          <Text className="text-xs text-ctp-subtext0">Due Now</Text>
          <Text className="text-xl font-bold text-ctp-red">{totalDueNow}</Text>
        </View>
      </View>
    </View>
  );

  const renderItem = ({ item: doc }: { item: MetricsRow }) => (
    <View className="px-4 pb-3">
      <Pressable onPress={() => handleOpenSession(doc)}>
        <Card>
          <CardContent>
            <View className="flex-row items-center justify-between py-1">
              {/* Doc title */}
              <View className="flex-1 mr-3">
                <Text className="text-base font-semibold text-ctp-text" numberOfLines={1}>
                  {doc.documentTitle}
                </Text>
                <Text className="text-xs text-ctp-subtext0 mt-0.5">
                  {doc.totalCards} cards · Retention {doc.avgRetrievability}%
                </Text>
              </View>

              {/* Badges */}
              <View className="flex-row gap-2">
                {doc.dueNowCount > 0 && (
                  <Badge variant="destructive">{doc.dueNowCount} due</Badge>
                )}
                {doc.newCardsCount > 0 && (
                  <Badge variant="default">{doc.newCardsCount} new</Badge>
                )}
                {doc.dueNowCount === 0 && doc.newCardsCount === 0 && (
                  <Badge variant="success">Caught up</Badge>
                )}
              </View>
            </View>
          </CardContent>
        </Card>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-ctp-base">
      <FlatList
        data={metrics}
        keyExtractor={(doc) => doc.documentId}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={<View className="h-16" />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={true}
      />
    </SafeAreaView>
  );
}
