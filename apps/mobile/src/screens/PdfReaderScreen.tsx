/**
 * PDF Reader — renders PDF with react-pdf-highlighter-plus inside a WebView.
 *
 * Communication:
 *   RN  → WebView: postMessage({ type: "init", pdfBase64, annotations })
 *   WebView → RN:  postMessage({ type: "highlight-click" | "text-selection" | ... })
 */
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import { useAnnotationStore } from "../stores/annotation.store";

interface Props {
  documentId: string;
  title: string;
  pdfPath: string;
  onClose: () => void;
}

// Load the inlined HTML from assets
const PDF_VIEWER_HTML = require("../../assets/pdf-viewer/index.html") as string;

export default function PdfReaderScreen({ documentId, title, pdfPath, onClose }: Props) {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allItems = useAnnotationStore((s) => s.items);
  const annotations = useMemo(
    () => allItems.filter((i) => i.documentId === documentId),
    [allItems, documentId],
  );

  // Load PDF as base64 and send to WebView
  useEffect(() => {
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(pdfPath);
        if (!info.exists) {
          setError("PDF not found. Sync with desktop first.");
          setLoading(false);
          return;
        }
        const pdfBase64 = await FileSystem.readAsStringAsync(pdfPath, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Send init message to WebView once it's loaded
        const initMsg = JSON.stringify({
          type: "init",
          pdfBase64,
          documentId,
          annotations: annotations.map((a) => ({
            id: a.id,
            text: a.text,
            pageNumber: a.pageNumber,
            position: a.embedData.position,
          })),
        });

        // Wait a bit for WebView to render then send data
        setTimeout(() => {
          webRef.current?.postMessage(initMsg);
        }, 500);
      } catch (err) {
        console.error("[PdfReader] failed to load PDF:", err);
        setError("Failed to load PDF file.");
      } finally {
        setLoading(false);
      }
    })();
  }, [pdfPath]);

  // Handle messages from WebView
  const handleMessage = useCallback(
    (event: any) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        switch (msg.type) {
          case "highlight-click":
            // Highlight tapped — scroll to it / show detail
            break;
          case "text-selection":
            // Text selected — could trigger annotation creation
            break;
          case "loaded":
            // WebView ready — resend init if already loaded
            break;
          case "error":
            console.warn("[PdfReader] WebView error:", msg.message);
            break;
        }
      } catch {
        // ignore malformed messages
      }
    },
    [],
  );

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
        <TouchableOpacity onPress={() => {}}>
          <Text style={styles.annoBtn}>Notes ({annotations.length})</Text>
        </TouchableOpacity>
      </View>

      {/* PDF Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>Loading PDF…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text>{error}</Text>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ html: PDF_VIEWER_HTML }}
          style={{ flex: 1, backgroundColor: "#525659" }}
          originWhitelist={["*"]}
          javaScriptEnabled={true}
          onMessage={handleMessage}
          onError={() => setError("WebView failed to load")}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
        />
      )}
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
});
