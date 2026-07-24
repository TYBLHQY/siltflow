/**
 * ReviewSession — flashcard review flow for a single document.
 *
 * Workflow:
 * 1. Load all annotations + FSRS cards for the document
 * 2. Filter to due/overdue cards (or all new cards)
 * 3. Show one card at a time with "tap to reveal" → grade buttons
 * 4. After grading, advance to next card
 * 5. Show completion screen when all cards are reviewed
 *
 * Data loading uses the useFocusEffect + useState pattern to avoid
 * blocking the JS thread with synchronous DB access during render.
 */

import { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, SafeAreaView, ScrollView } from "@/tw";
import { Button, Badge, Spinner } from "@/components/ui";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getSQLite } from "@/stores/db.store";
import { listAnnotations } from "@/services/annotations.service";
import { listFSRSCardsByDocument } from "@/services/fsrs-cards.service";
import { reviewAnnotation, initAnnotationCard } from "@/stores/fsrs.store";
import { enrichedToItem, type AnnotationItem } from "@/stores/annotation.store";
import { GRADE_LABEL } from "@siltflow/shared-lib";
import type { Card as FSRSCard } from "ts-fsrs";
import type { Grade } from "ts-fsrs";
import { ReviewCard } from "./ReviewCard";

// ── Grade button styles ─────────────────────────────────────────────

const GRADE_STYLES: Record<number, { bg: string; text: string }> = {
  1: { bg: "bg-ctp-red/15", text: "text-ctp-red" },
  2: { bg: "bg-ctp-peach/15", text: "text-ctp-peach" },
  3: { bg: "bg-ctp-green/15", text: "text-ctp-green" },
  4: { bg: "bg-ctp-blue/15", text: "text-ctp-blue" },
};

// ── Types ───────────────────────────────────────────────────────────

interface SessionItem {
  annotation: AnnotationItem;
  fsrsCard: FSRSCard | null;
}

interface SessionSummary {
  total: number;
  grades: Record<number, number>;
}

export function ReviewSession() {
  const router = useRouter();
  const { documentId } = useLocalSearchParams<{
    documentId: string;
  }>();

  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session items when screen mounts (lazy, not during render)
  useEffect(() => {
    try {
      setLoading(true);
      const sql = getSQLite();
      const enriched = listAnnotations(sql, documentId);
      const annotationItems = enriched.map((e) => enrichedToItem(e));

      const cardsByAnnotation = new Map<string, FSRSCard>();
      const cardRows = listFSRSCardsByDocument(sql, documentId);
      for (const row of cardRows) {
        try {
          cardsByAnnotation.set(row.annotationId, JSON.parse(row.data) as FSRSCard);
        } catch { /* skip corrupt data */ }
      }

      const now = new Date();
      const sessionItems: SessionItem[] = [];
      for (const ann of annotationItems) {
        const card = cardsByAnnotation.get(ann.id) ?? null;
        if (!card) {
          sessionItems.push({ annotation: ann, fsrsCard: null });
        } else {
          const dueDate = card.due instanceof Date ? card.due : new Date(card.due as unknown as string);
          if (dueDate <= now || card.state === 1 || card.state === 3) {
            sessionItems.push({ annotation: ann, fsrsCard: card });
          }
        }
      }

      // Sort: overdue first, then new, then due soon
      sessionItems.sort((a, b) => {
        const aDue = a.fsrsCard ? new Date(a.fsrsCard.due as unknown as string).getTime() : 0;
        const bDue = b.fsrsCard ? new Date(b.fsrsCard.due as unknown as string).getTime() : 0;
        return aDue - bDue;
      });

      setItems(sessionItems);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // Grade the current card
  const handleGrade = useCallback(
    (grade: Grade) => {
      if (!items) return;
      const current = items[index];
      if (!current) return;

      try {
        const card = current.fsrsCard ?? initAnnotationCard();
        const result = reviewAnnotation(
          current.annotation.id,
          current.annotation.documentId,
          grade,
          card,
        );

        if (result) {
          setSessionSummary((prev) => {
            const s = prev ?? { total: 0, grades: { 1: 0, 2: 0, 3: 0, 4: 0 } };
            return {
              total: s.total + 1,
              grades: { ...s.grades, [grade]: (s.grades[grade] ?? 0) + 1 },
            };
          });
        }
      } catch (err) {
        console.error("[ReviewSession] grade failed:", err);
      }

      if (index + 1 < items.length) {
        setIndex((i) => i + 1);
        setAnswerRevealed(false);
      } else {
        setIndex(items.length);
      }
    },
    [items, index],
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // ── Render: Loading / Error ────────────────────────────────────────

  if (loading || !items) {
    return (
      <SafeAreaView className="flex-1 bg-ctp-base">
        <View className="flex-1 items-center justify-center gap-4">
          <Spinner size="lg" label="Loading cards..." />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-ctp-base">
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-ctp-red text-center">{error}</Text>
          <Button variant="outline" onPress={handleBack}>Back</Button>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: No cards to review ────────────────────────────────────

  if (items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-ctp-base">
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-5xl">🎉</Text>
          <Text className="text-xl font-bold text-ctp-text">All caught up!</Text>
          <Text className="text-ctp-subtext0 text-center">
            No cards are due for review in this document.
          </Text>
          <Button variant="outline" onPress={handleBack}>
            Back to Documents
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Session complete ──────────────────────────────────────

  if (index >= items.length && sessionSummary) {
    return (
      <SafeAreaView className="flex-1 bg-ctp-base">
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-6 gap-6 items-center"
        >
          <View className="items-center gap-4 mt-12">
            <Text className="text-5xl">✅</Text>
            <Text className="text-2xl font-bold text-ctp-text">
              Session Complete!
            </Text>
            <Text className="text-ctp-subtext0">
              {sessionSummary.total} card{sessionSummary.total !== 1 ? "s" : ""} reviewed
            </Text>
          </View>

          {/* Grade breakdown */}
          <View className="w-full gap-2">
            <Text className="text-sm font-semibold text-ctp-subtext0 mb-2">
              Grade Distribution
            </Text>
            {([4, 3, 2, 1] as const).map((grade) => {
              const count = sessionSummary.grades[grade] ?? 0;
              const pct = sessionSummary.total > 0
                ? Math.round((count / sessionSummary.total) * 100)
                : 0;
              const style = GRADE_STYLES[grade];
              return (
                <View key={grade} className="flex-row items-center gap-3">
                  <Badge variant={grade === 1 ? "destructive" : grade === 2 ? "warning" : grade === 3 ? "success" : "default"}>
                    {GRADE_LABEL[grade]}
                  </Badge>
                  <View className="flex-1 h-5 bg-ctp-surface0 rounded-full overflow-hidden">
                    <View
                      className={`h-full rounded-full ${style.bg}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </View>
                  <Text className="text-sm text-ctp-subtext0 w-8 text-right">{count}</Text>
                </View>
              );
            })}
          </View>

          <Button onPress={handleBack} className="mt-4">
            Back to Documents
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: Active review ─────────────────────────────────────────

  const current = items[index];
  const progress = `${index + 1} / ${items.length}`;

  return (
    <SafeAreaView className="flex-1 bg-ctp-base">
      {/* Header — progress only */}
      <View className="flex-row items-center justify-center px-4 py-3 border-b border-ctp-surface0">
        <Text className="text-sm font-semibold text-ctp-text">{progress}</Text>
      </View>

      {/* Progress bar */}
      <View className="h-1 bg-ctp-surface0">
        <View
          className="h-full bg-ctp-blue rounded-r-full"
          style={{ width: `${((index + 1) / items.length) * 100}%` }}
        />
      </View>

      {/* Card area */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
      >
        <ReviewCard
          item={current.annotation}
          answerRevealed={answerRevealed}
          onReveal={() => setAnswerRevealed(true)}
        />
      </ScrollView>

      {/* Grade buttons (only visible after reveal) */}
      {answerRevealed && (
        <View className="flex-row gap-2 px-4 py-3 border-t border-ctp-surface0">
          {([1, 2, 3, 4] as const).map((grade) => {
            const style = GRADE_STYLES[grade];
            return (
              <Pressable
                key={grade}
                onPress={() => handleGrade(grade)}
                className={`flex-1 items-center rounded-lg py-3 ${style.bg}`}
              >
                <Text className={`text-lg font-semibold ${style.text}`}>
                  {GRADE_LABEL[grade]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Hint when answer not revealed */}
      {!answerRevealed && (
        <View className="px-4 py-2 border-t border-ctp-surface0">
          <Text className="text-xs text-ctp-overlay0 text-center">
            Tap the card to reveal the answer, then select a grade
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
