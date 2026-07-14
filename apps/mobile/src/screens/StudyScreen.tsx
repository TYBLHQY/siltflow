/**
 * Study screen — FSRS card review interface.
 * Front: original text + translation. Tap to reveal → definitions + examples → grade.
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAnnotationStore } from "../stores/annotation.store";
import { reviewAnnotation } from "../stores/fsrs.store";
import type { AIAnnotationData } from "@siltflow/shared/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface StudyScreenProps {
  documentId: string;
  onBack: () => void;
}

export default function StudyScreen({ documentId, onBack }: StudyScreenProps) {
  const allItems = useAnnotationStore((s) => s.items);
  const annotations = useMemo(
    () => allItems.filter((i) => i.documentId === documentId),
    [allItems, documentId],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Scroll to top when card changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentIndex]);

  const current = annotations[currentIndex];

  const handleGrade = useCallback(
    (grade: 1 | 2 | 3 | 4) => {
      if (!current) return;
      reviewAnnotation(current.id, grade as any);
      if (currentIndex < annotations.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setRevealed(false);
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    },
    [current, currentIndex, annotations.length],
  );

  // ── Done state ──
  if (!current || currentIndex >= annotations.length) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={styles.doneTitle}>All done!</Text>
          <Text style={styles.doneSubtitle}>
            Reviewed {annotations.length} card{annotations.length !== 1 ? "s" : ""}
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={onBack}>
            <Text style={styles.doneBtnText}>Back to list</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const aiData: AIAnnotationData | null = current.aiResult ?? null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentIndex + 1) / annotations.length) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {currentIndex + 1} / {annotations.length}
          </Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* ── Card Content ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Original text */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>TEXT</Text>
          <Text style={styles.originalText}>{current.text}</Text>

          {/* Translation — always visible if available */}
          {aiData && (
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.sectionLabel}>TRANSLATION</Text>
              <Text style={styles.translationText}>{aiData.translation}</Text>
            </View>
          )}
        </View>

        {/* Revealed content */}
        {revealed && aiData && (
          <View style={styles.cardRevealed}>
            {/* Definitions */}
            {aiData.definitions && aiData.definitions.length > 0 && (
              <View style={styles.revealSection}>
                <Text style={styles.revealSectionTitle}>Definitions</Text>
                {aiData.definitions.map((d, i) => (
                  <View key={i} style={styles.defRow}>
                    <View style={styles.defBullet} />
                    <Text style={styles.defText}>
                      {d.pos ? <Text style={styles.posTag}>{d.pos}</Text> : null}
                      {" "}{d.definition}
                      {d.gloss ? (
                        <Text style={styles.glossText}> — {d.gloss}</Text>
                      ) : null}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Examples */}
            {aiData.examples && aiData.examples.length > 0 && (
              <View style={styles.revealSection}>
                <Text style={styles.revealSectionTitle}>Examples</Text>
                {aiData.examples.slice(0, 3).map((ex, i) => (
                  <View key={i} style={styles.exampleCard}>
                    <Text style={styles.exampleSentence}>{ex.sentence}</Text>
                    <Text style={styles.exampleTranslation}>{ex.translation}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Pronunciation */}
            {aiData.pronunciation?.ipa && (
              <View style={styles.revealSection}>
                <Text style={styles.revealSectionTitle}>Pronunciation</Text>
                <Text style={styles.ipaText}>{aiData.pronunciation.ipa}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Actions (fixed bottom) ── */}
      <View style={styles.actions}>
        {!revealed ? (
          <TouchableOpacity
            style={styles.revealBtn}
            onPress={() => setRevealed(true)}
            activeOpacity={0.8}
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
      activeOpacity={0.7}
    >
      <Text style={styles.gradeBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f0" },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
  },
  headerBtn: { width: 60 },
  headerBtnText: { fontSize: 16, color: "#4a90d9", fontWeight: "600" },
  headerCenter: { flex: 1, alignItems: "center" },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4a90d9",
    borderRadius: 2,
  },
  progressText: { fontSize: 12, color: "#888" },

  // ── Done state ──
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  doneEmoji: { fontSize: 64, marginBottom: 16 },
  doneTitle: { fontSize: 28, fontWeight: "700", color: "#333", marginBottom: 8 },
  doneSubtitle: { fontSize: 16, color: "#666", marginBottom: 28 },
  doneBtn: {
    backgroundColor: "#4a90d9",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  doneBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // ── Card area ──
  scrollArea: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 4 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  originalText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#222",
    lineHeight: 28,
  },
  divider: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  translationText: {
    fontSize: 17,
    color: "#555",
    lineHeight: 24,
  },

  // ── Revealed card ──
  cardRevealed: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  revealSection: { marginBottom: 16 },
  revealSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
    marginBottom: 8,
  },

  // Definitions
  defRow: { flexDirection: "row", marginBottom: 6, alignItems: "flex-start" },
  defBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4a90d9",
    marginTop: 7,
    marginRight: 8,
    flexShrink: 0,
  },
  defText: { fontSize: 15, color: "#444", lineHeight: 22, flex: 1 },
  posTag: {
    fontSize: 12,
    color: "#888",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
    fontWeight: "600",
    marginRight: 4,
  },
  glossText: { color: "#888", fontStyle: "italic" },

  // Examples
  exampleCard: {
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  exampleSentence: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
    fontWeight: "500",
  },
  exampleTranslation: {
    fontSize: 14,
    color: "#777",
    lineHeight: 20,
    marginTop: 4,
    fontStyle: "italic",
  },

  // Pronunciation
  ipaText: {
    fontSize: 18,
    color: "#666",
    fontFamily: "monospace",
    textAlign: "center",
    padding: 10,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
  },

  // ── Actions ──
  actions: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: "#f0f0f0",
  },
  revealBtn: {
    backgroundColor: "#4a90d9",
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#4a90d9",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  revealBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  rateLabel: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginBottom: 10,
  },
  gradeRow: { flexDirection: "row", gap: 8 },
  gradeBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gradeBtnLabel: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
});
