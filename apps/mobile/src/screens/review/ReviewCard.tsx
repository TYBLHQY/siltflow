/**
 * ReviewCard — single flashcard component for the review session.
 *
 * Two states:
 *   question (answerRevealed=false) — shows the annotation text as a prompt
 *   answer (answerRevealed=true) — shows AI translation + FSRS stats
 */

import { View, Text, Pressable } from "@/tw";
import { Card, CardContent, Badge } from "@/components/ui";
import { STATE_LABEL } from "@siltflow/shared-lib";
import type { AnnotationItem } from "@/stores/annotation.store";

export interface ReviewCardProps {
  item: AnnotationItem;
  answerRevealed: boolean;
  onReveal: () => void;
}

export function ReviewCard({ item, answerRevealed, onReveal }: ReviewCardProps) {
  const aiData = item.aiResult as Record<string, unknown> | undefined;
  const fsrsCard = item.fsrsCard as { state?: number; stability?: number; difficulty?: number; due?: string; reps?: number; lapses?: number } | undefined;

  const stateLabel = fsrsCard?.state != null ? STATE_LABEL[fsrsCard.state] ?? "New" : "New";
  const translation = aiData ? (aiData.translation as string | undefined) : undefined;
  const ipa = aiData?.pronunciation ? (aiData.pronunciation as Record<string, unknown>).ipa as string | undefined : undefined;
  const definitions = aiData?.definitions as Array<{ definition?: string; gloss?: string }> | undefined;
  const difficulty = aiData?.metadata ? (aiData.metadata as Record<string, unknown>).difficulty as string | undefined : undefined;

  if (!answerRevealed) {
    return (
      <Pressable onPress={onReveal}>
        <Card>
          <CardContent>
            <View className="items-center justify-center py-12 gap-4">
              <Text className="text-2xl text-ctp-text text-center leading-relaxed">
                {item.text || "(no text)"}
              </Text>
              <View className="flex-row items-center gap-2">
                <Badge variant="secondary">{stateLabel}</Badge>
                {difficulty && <Badge variant="outline">{difficulty}</Badge>}
              </View>
              <Text className="text-sm text-ctp-overlay0 mt-4">
                Tap to reveal answer
              </Text>
            </View>
          </CardContent>
        </Card>
      </Pressable>
    );
  }

  return (
    <Card>
      <CardContent>
        <View className="py-4 gap-4">
          {/* Question text (repeated) */}
          <View className="border-l-2 border-ctp-blue pl-3">
            <Text className="text-xl text-ctp-text leading-relaxed">
              {item.text || "(no text)"}
            </Text>
          </View>

          {/* Translation */}
          {translation && (
            <View className="bg-ctp-surface0 rounded-lg p-4">
              <Text className="text-xs text-ctp-overlay0 mb-1">Translation</Text>
              <Text className="text-base text-ctp-text">{translation}</Text>
            </View>
          )}

          {/* IPA pronunciation */}
          {ipa && (
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-ctp-overlay0">IPA</Text>
              <Text className="text-sm text-ctp-subtext1">/{ipa}/</Text>
            </View>
          )}

          {/* Definitions */}
          {definitions && definitions.length > 0 && (
            <View className="gap-1">
              <Text className="text-xs text-ctp-overlay0 mb-1">Definitions</Text>
              {definitions.filter(d => d.definition || d.gloss).slice(0, 5).map((d, i) => (
                <View key={i} className="flex-row gap-2">
                  <Text className="text-sm text-ctp-subtext0">•</Text>
                  <Text className="text-sm text-ctp-text">{d.definition || d.gloss}</Text>
                </View>
              ))}
            </View>
          )}

          {/* FSRS Card Stats */}
          {fsrsCard && (
            <View className="flex-row flex-wrap gap-2 pt-2">
              <Badge variant="secondary">{stateLabel}</Badge>
              {fsrsCard.reps != null && (
                <Badge variant="outline">{fsrsCard.reps} reps</Badge>
              )}
              {fsrsCard.lapses != null && fsrsCard.lapses > 0 && (
                <Badge variant="destructive">{fsrsCard.lapses} lapses</Badge>
              )}
              {difficulty && <Badge variant="outline">{difficulty}</Badge>}
            </View>
          )}

          {/* No AI data placeholder */}
          {!aiData && (
            <Text className="text-sm text-ctp-overlay0 italic">
              No AI translation data available for this card.
            </Text>
          )}
        </View>
      </CardContent>
    </Card>
  );
}
