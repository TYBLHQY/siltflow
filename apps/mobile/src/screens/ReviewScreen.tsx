import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDocumentStore } from "../stores/document.store";
import { useAnnotationStore } from "../stores/annotation.store";
import StudyScreen from "./StudyScreen";

/**
 * Review tab — select a document, then study its cards.
 */
export default function ReviewScreen() {
  const documents = useDocumentStore((s) => s.documents);
  const items = useAnnotationStore((s) => s.items);
  const [studyingDocId, setStudyingDocId] = useState<string | null>(null);

  // Only docs that have annotations
  const docsWithCards = documents.filter(
    (d) => items.some((i) => i.documentId === d.id),
  );

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
        <Text style={styles.headerTitle}>Review</Text>
      </View>
      <FlatList
        data={docsWithCards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.docRow}
            onPress={() => setStudyingDocId(item.id)}
          >
            <Text style={styles.docIcon}>📄</Text>
            <Text style={styles.docTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No annotations to review.{ "\n"}Sync from desktop first.
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
  docTitle: { flex: 1, fontSize: 16, fontWeight: "600", color: "#333" },
  arrow: { fontSize: 18, color: "#ccc", marginLeft: 8 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 15, color: "#999", textAlign: "center", lineHeight: 22 },
});
