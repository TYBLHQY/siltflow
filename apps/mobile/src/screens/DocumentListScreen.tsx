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
import StudyScreen from "./StudyScreen";

export default function DocumentListScreen() {
  const documents = useDocumentStore((s) => s.documents);
  const loaded = useDocumentStore((s) => s.loaded);
  const loadFromDb = useDocumentStore.getState().loadFromDb;
  const items = useAnnotationStore((s) => s.items);
  const [refreshing, setRefreshing] = useState(false);
  const [studyingDocId, setStudyingDocId] = useState<string | null>(null);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!loaded) loadFromDb();
  }, []);

  // Reload when screen comes into focus (e.g. after sync)
  useEffect(() => {
    if (isFocused && loaded) loadFromDb();
  }, [isFocused]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFromDb();
    setRefreshing(false);
  }, []);

  // Cards per document
  const docCardCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.documentId, (map.get(item.documentId) ?? 0) + 1);
    }
    return map;
  }, [items]);

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
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const cardCount = docCardCounts.get(item.id) ?? 0;
          return (
            <TouchableOpacity
              style={styles.docRow}
              onPress={() => cardCount > 0 && setStudyingDocId(item.id)}
              disabled={cardCount === 0}
            >
              <Text style={styles.docIcon}>📄</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.docMeta}>
                  {cardCount} card{cardCount !== 1 ? "s" : ""}
                </Text>
              </View>
              {cardCount > 0 && <Text style={styles.arrow}>→</Text>}
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
  docMeta: { fontSize: 13, color: "#888", marginTop: 2 },
  arrow: { fontSize: 18, color: "#ccc", marginLeft: 8 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 15, color: "#999", textAlign: "center", lineHeight: 22 },
});
