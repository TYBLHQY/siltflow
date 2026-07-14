import React, { useEffect, useState, useCallback } from "react";
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
import PdfReaderScreen from "./PdfReaderScreen";

export default function DocumentListScreen() {
  const { documents, loaded, loadFromDb } = useDocumentStore();
  const [refreshing, setRefreshing] = useState(false);

  // PDF reader state
  const [pdfDocId, setPdfDocId] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfPath, setPdfPath] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) loadFromDb();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFromDb();
    setRefreshing(false);
  }, []);

  const openPdf = async (doc: { id: string; title: string }) => {
    // Try to load PDF from synced storage
    const { getPdfPath } = await import("../sync/client");
    const client = new (await import("../sync/client")).SyncClient("", 0);
    setPdfDocId(doc.id);
    setPdfTitle(doc.title);
    setPdfPath(client.getPdfPath(doc.id));
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Documents</Text>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.docRow} onPress={() => openPdf(item)}>
            <Text style={styles.docIcon}>📄</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.docTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {item.totalPages ? (
                <Text style={styles.docMeta}>{item.totalPages} pages</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
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

      {/* PDF Reader Modal */}
      {pdfDocId && pdfPath && (
        <Modal visible animationType="fullScreen">
          <PdfReaderScreen
            documentId={pdfDocId}
            title={pdfTitle}
            pdfPath={pdfPath}
            onClose={() => {
              setPdfDocId(null);
              setPdfPath(null);
            }}
          />
        </Modal>
      )}
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
  },
  docIcon: { fontSize: 18, marginRight: 12 },
  docTitle: { fontSize: 16, fontWeight: "600", color: "#333" },
  docMeta: { fontSize: 12, color: "#999", marginTop: 2 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 15, color: "#999", textAlign: "center", lineHeight: 22 },
});
