/**
 * PDF Reader — renders PDF using WebView with base64 embedding.
 * PDFs are synced from desktop and stored in expo-file-system.
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import { useAnnotationStore, type AnnotationItem } from "../stores/annotation.store";

interface Props {
  documentId: string;
  title: string;
  pdfPath: string;
  onClose: () => void;
}

export default function PdfReaderScreen({ documentId, title, pdfPath, onClose }: Props) {
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<AnnotationItem | null>(null);

  const items = useAnnotationStore((s) =>
    s.items.filter((i) => i.documentId === documentId),
  );

  // Load PDF as base64
  useEffect(() => {
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(pdfPath);
        if (!info.exists) {
          setLoading(false);
          return;
        }
        const base64 = await FileSystem.readAsStringAsync(pdfPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setPdfBase64(base64);
      } catch (err) {
        console.error("[PdfReader] failed to load PDF:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [pdfPath]);

  const html = pdfBase64
    ? `<!DOCTYPE html><html><body style="margin:0">
        <embed src="data:application/pdf;base64,${pdfBase64}" type="application/pdf" width="100%" height="100%" />
      </body></html>`
    : undefined;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity onPress={() => setShowAnnotations(true)}>
          <Text style={styles.annoBtn}>
            Notes ({items.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* PDF Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>Loading PDF…</Text>
        </View>
      ) : html ? (
        <WebView
          source={{ html }}
          style={{ flex: 1 }}
          originWhitelist={["*"]}
          javaScriptEnabled={false}
        />
      ) : (
        <View style={styles.centered}>
          <Text>PDF not found. Sync with desktop first.</Text>
        </View>
      )}

      {/* Annotations Sidebar Modal */}
      <Modal visible={showAnnotations} animationType="slide" transparent>
        <View style={styles.sidebarOverlay}>
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Annotations</Text>
              <TouchableOpacity onPress={() => setShowAnnotations(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.annotationCard}
                  onPress={() => setSelectedAnnotation(item)}
                >
                  <Text style={styles.annoText} numberOfLines={2}>
                    {item.text}
                  </Text>
                  {item.aiResult && (
                    <Text style={styles.annoTranslation} numberOfLines={2}>
                      {item.aiResult.translation}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No annotations yet.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Annotation Detail Modal */}
      <Modal visible={!!selectedAnnotation} animationType="fade" transparent>
        <View style={styles.detailOverlay}>
          <View style={styles.detailCard}>
            {selectedAnnotation && (
              <>
                <Text style={styles.detailTitle}>Selected Text</Text>
                <Text style={styles.detailText}>{selectedAnnotation.text}</Text>
                {selectedAnnotation.aiResult && (
                  <>
                    <Text style={styles.detailTitle}>Translation</Text>
                    <Text style={styles.detailTranslation}>
                      {selectedAnnotation.aiResult.translation}
                    </Text>
                    {selectedAnnotation.aiResult.definitions?.length > 0 && (
                      <>
                        <Text style={styles.detailTitle}>Definitions</Text>
                        {selectedAnnotation.aiResult.definitions.map((d, i) => (
                          <Text key={i} style={styles.defLine}>
                            {d.pos ? `(${d.pos}) ` : ""}{d.definition}
                          </Text>
                        ))}
                      </>
                    )}
                  </>
                )}
                <TouchableOpacity
                  style={styles.closeDetailBtn}
                  onPress={() => setSelectedAnnotation(null)}
                >
                  <Text style={styles.closeDetailText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
  },
  backBtn: { fontSize: 16, color: "#4a90d9", marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "700" },
  annoBtn: { fontSize: 14, color: "#4a90d9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Sidebar
  sidebarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  sidebar: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "60%",
    paddingBottom: 20,
  },
  sidebarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  sidebarTitle: { fontSize: 18, fontWeight: "700" },
  closeBtn: { fontSize: 20, color: "#999" },
  annotationCard: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
  },
  annoText: { fontSize: 14, fontWeight: "600", color: "#333" },
  annoTranslation: { fontSize: 13, color: "#666", marginTop: 4 },
  emptyText: { padding: 20, textAlign: "center", color: "#999" },
  // Detail
  detailOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    maxHeight: "70%",
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 4,
  },
  detailText: { fontSize: 16, color: "#333", lineHeight: 22 },
  detailTranslation: { fontSize: 15, color: "#555", lineHeight: 20 },
  defLine: { fontSize: 14, color: "#444", lineHeight: 20, marginLeft: 8 },
  closeDetailBtn: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  closeDetailText: { fontSize: 15, color: "#333", fontWeight: "600" },
});
