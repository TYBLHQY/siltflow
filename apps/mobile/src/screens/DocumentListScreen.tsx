import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDocumentStore } from "../stores/document.store";
import { useAnnotationStore } from "../stores/annotation.store";
import { computeDocMetrics, type DocReviewMetrics } from "@siltflow/shared/fsrs";
import StudyScreen from "./StudyScreen";

export default function DocumentListScreen() {
  const documents = useDocumentStore((s) => s.documents);
  const loaded = useDocumentStore((s) => s.loaded);
  const loadFromDb = useDocumentStore.getState().loadFromDb;
  const items = useAnnotationStore((s) => s.items);
  const [refreshing, setRefreshing] = useState(false);
  const [studyingDocId, setStudyingDocId] = useState<string | null>(null);
  const isFocused = useIsFocused();

  // Cards per document with FSRS metrics
  const docMetrics = useMemo(() => {
    const byDoc: Record<string, { title: string; cards: any[] }> = {};
    for (const doc of documents) {
      byDoc[doc.id] = { title: doc.title, cards: [] };
    }
    for (const item of items) {
      if (item.fsrsCard && byDoc[item.documentId]) {
        byDoc[item.documentId].cards.push({
          ...item.fsrsCard,
          due: new Date(item.fsrsCard.due ?? Date.now()),
        });
      }
    }
    return computeDocMetrics(byDoc);
  }, [documents, items]);

  useEffect(() => {
    if (!loaded) loadFromDb();
  }, []);

  // Reload docs + annotations when screen comes into focus
  useEffect(() => {
    if (isFocused && loaded) {
      loadFromDb();
      useAnnotationStore.getState().loadFromDb();
    }
  }, [isFocused]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFromDb();
    setRefreshing(false);
  }, []);

  function statusLabel(m: DocReviewMetrics): string {
    if (m.compositeScore === -1) return "";
    if (m.avgRetrievability >= 90) return "Fresh";
    if (m.avgRetrievability >= 75) return "Good";
    if (m.avgRetrievability >= 50) return "Aging";
    return "Stale";
  }

  if (studyingDocId) {
    return (
      <StudyScreen
        documentId={studyingDocId}
        onBack={() => setStudyingDocId(null)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Study</Text>
      </View>

      <FlatList
        data={docMetrics}
        keyExtractor={(item) => item.documentId}
        renderItem={({ item }) => {
          const status = statusLabel(item);
          return (
            <TouchableOpacity
              style={styles.docRow}
              onPress={() => item.totalCards > 0 && setStudyingDocId(item.documentId)}
              disabled={item.totalCards === 0}
            >
              <Text style={styles.docIcon}>📄</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle} numberOfLines={1}>
                  {item.documentTitle}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.docMeta}>
                    {item.totalCards} card{item.totalCards !== 1 ? "s" : ""}
                    {item.dueNowCount > 0 ? ` · ${item.dueNowCount} due` : ""}
                    {item.dueSoonCount > 0 ? ` · ${item.dueSoonCount} soon` : ""}
                    {item.newCardsCount > 0 ? ` · ${item.newCardsCount} new` : ""}
                  </Text>
                  <Text style={styles.statusBadge}>{statusLabel(item)}</Text>
                </View>
              </View>
              {item.totalCards > 0 && <Text style={styles.arrow}>→</Text>}
            </TouchableOpacity>
          );
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No documents yet.{ "\n"}Sync from desktop to get started.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
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
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
  },
  docIcon: { fontSize: 18, marginRight: 12 },
  docTitle: { fontSize: 16, fontWeight: "600", color: "#333" },
  docMeta: { fontSize: 12, color: "#888", marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 2, gap: 8 },
  statusBadge: { fontSize: 12, fontWeight: "600", color: "#888" },
  arrow: { fontSize: 18, color: "#ccc", marginLeft: 8 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 15, color: "#999", textAlign: "center", lineHeight: 22 },
});
