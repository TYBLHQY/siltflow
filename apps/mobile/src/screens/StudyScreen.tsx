/**
 * Study screen — FSRS card review interface for mobile.
 * Shows one card at a time: front (text + translation) → flip → rate.
 *
 * Ratings are persisted via reviewAnnotation() which:
 * 1. Runs FSRS engine to compute next review
 * 2. Updates FSRS card in annotations store
 * 3. Writes review_log to database
 */
import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAnnotationStore, type AnnotationItem } from "../stores/annotation.store";
import { reviewAnnotation } from "../stores/fsrs.store";
import type { AIAnnotationData } from "@siltflow/shared/types";

// ── Study phases ──

type StudyPhase = "select-doc" | "study";

export default function StudyScreen() {
  const items = useAnnotationStore((s) => s.items);
  const [phase, setPhase] = useState<StudyPhase>("select-doc");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Group by document
  const docsWithCards = useMemo(() => {
    const map = new Map<string, AnnotationItem[]>();
    for (const item of items) {
      const list = map.get(item.documentId) ?? [];
      list.push(item);
      map.set(item.documentId, list);
    }
    return Array.from(map.entries()).map(([id, annotations]) => ({
      documentId: id,
      annotationCount: annotations.length,
    }));
  }, [items]);

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    setPhase("study");
  };

  if (phase === "study" && selectedDocId) {
    return (
      <StudySession
        documentId={selectedDocId}
        annotations={items.filter((i) => i.documentId === selectedDocId)}
        onBack={() => setPhase("select-doc")}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Document to Study</Text>
      </View>
      <FlatList
        data={docsWithCards}
        keyExtractor={(item) => item.documentId}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.docCard}
            onPress={() => handleSelectDoc(item.documentId)}
          >
            <Text style={styles.docCardTitle}>
              Document {item.documentId.slice(0, 8)}…
            </Text>
            <Text style={styles.docCardCount}>
              {item.annotationCount} card{item.annotationCount !== 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No annotations to study.{ "\n"}Sync annotations from desktop first.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── Study Session ──

interface StudySessionProps {
  documentId: string;
  annotations: AnnotationItem[];
  onBack: () => void;
}

function StudySession({ documentId, annotations, onBack }: StudySessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const current = annotations[currentIndex];

  const handleGrade = useCallback(
    (grade: 1 | 2 | 3 | 4) => {
      if (!current) return;
      reviewAnnotation(current.id, grade as any);
      // Move to next card
      if (currentIndex < annotations.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setRevealed(false);
      } else {
        // Finished all cards
        setRevealed(false);
      }
    },
    [current, currentIndex, annotations.length],
  );

  if (!current || currentIndex >= annotations.length) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={styles.doneTitle}>All done! 🎉</Text>
          <Text style={styles.doneSubtitle}>
            Reviewed {annotations.length} cards
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>Back to document list</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const aiData: AIAnnotationData | null = current.aiResult ?? null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.progress}>
          {currentIndex + 1} / {annotations.length}
        </Text>
      </View>

      {/* Card */}
      <View style={styles.cardArea}>
        {/* Front — always showing text */}
        <View style={styles.cardFront}>
          <Text style={styles.cardLabel}>TEXT</Text>
          <Text style={styles.cardText}>{current.text}</Text>

          {aiData && (
            <View style={styles.translationBox}>
              <Text style={styles.translationLabel}>TRANSLATION</Text>
              <Text style={styles.translationText}>{aiData.translation}</Text>
            </View>
          )}
        </View>

        {/* Back — revealed content */}
        {revealed && aiData && (
          <View style={styles.cardBack}>
            {aiData.definitions && aiData.definitions.length > 0 && (
              <>
                <Text style={styles.revealLabel}>DEFINITIONS</Text>
                {aiData.definitions.map((d, i) => (
                  <Text key={i} style={styles.defText}>
                    {d.pos ? `(${d.pos}) ` : ""}{d.definition}
                  </Text>
                ))}
              </>
            )}

            {aiData.examples && aiData.examples.length > 0 && (
              <>
                <Text style={[styles.revealLabel, { marginTop: 10 }]}>
                  EXAMPLES
                </Text>
                {aiData.examples.slice(0, 2).map((ex, i) => (
                  <Text key={i} style={styles.exampleText}>
                    "{ex.sentence}" → {ex.translation}
                  </Text>
                ))}
              </>
            )}

            {aiData.pronunciation?.ipa && (
              <Text style={styles.ipaText}>
                /{aiData.pronunciation.ipa}/
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {!revealed ? (
          <TouchableOpacity
            style={styles.revealBtn}
            onPress={() => setRevealed(true)}
          >
            <Text style={styles.revealBtnText}>Tap to Reveal</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.rateLabel}>How well did you remember?</Text>
            <View style={styles.gradeRow}>
              <GradeBtn label="Again" color="#e74c3c" onPress={() => handleGrade(1)} />
              <GradeBtn label="Hard" color="#e67e22" onPress={() => handleGrade(2)} />
              <GradeBtn label="Good" color="#27ae60" onPress={() => handleGrade(3)} />
              <GradeBtn label="Easy" color="#2980b9" onPress={() => handleGrade(4)} />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function GradeBtn({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.gradeBtn, { backgroundColor: color }]}
      onPress={onPress}
    >
      <Text style={styles.gradeBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  backBtn: { fontSize: 16, color: "#4a90d9" },
  progress: { fontSize: 15, color: "#888" },
  docCard: {
    backgroundColor: "#fff",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
  },
  docCardTitle: { fontSize: 16, fontWeight: "600" },
  docCardCount: { fontSize: 13, color: "#888", marginTop: 4 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 15, color: "#999", textAlign: "center", lineHeight: 22 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  doneTitle: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  doneSubtitle: { fontSize: 16, color: "#666", marginBottom: 20 },
  // Card
  cardArea: {
    flex: 1,
    padding: 16,
  },
  cardFront: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888",
    marginBottom: 6,
    letterSpacing: 1,
  },
  cardText: { fontSize: 18, color: "#222", lineHeight: 26, fontWeight: "600" },
  translationBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: "#eee" },
  translationLabel: { fontSize: 11, fontWeight: "700", color: "#888", marginBottom: 4, letterSpacing: 1 },
  translationText: { fontSize: 16, color: "#555", lineHeight: 22 },
  // Revealed
  cardBack: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  revealLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888",
    marginBottom: 4,
    letterSpacing: 1,
  },
  defText: { fontSize: 15, color: "#444", lineHeight: 22, marginLeft: 4 },
  exampleText: { fontSize: 14, color: "#666", lineHeight: 20, marginLeft: 4, fontStyle: "italic" },
  ipaText: {
    marginTop: 8,
    fontSize: 14,
    color: "#777",
    fontFamily: "monospace",
  },
  // Actions
  actions: {
    padding: 16,
    paddingBottom: 30,
  },
  revealBtn: {
    backgroundColor: "#4a90d9",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  revealBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  rateLabel: { fontSize: 14, color: "#888", textAlign: "center", marginBottom: 10 },
  gradeRow: { flexDirection: "row", gap: 8 },
  gradeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  gradeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
