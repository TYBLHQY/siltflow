/**
 * ReviewCard — single flashcard component for the review session.
 *
 * Mirrors desktop `AIAnnotationResultV2` rendering pattern:
 *   Header (granularity + page + version) → Source text → AI output
 *
 * Two states:
 *   question (answerRevealed=false) — shows annotation text + hint
 *   answer (answerRevealed=true) — shows full V2 AI result + FSRS stats
 *
 * All text containers use flex-1 + leading-relaxed in flex-row layouts
 * so long content wraps instead of clipping.
 */

import { View, Text, Pressable } from "@/tw";
import { Badge } from "@/components/ui";
import { STATE_LABEL } from "@siltflow/shared-lib";
import type {
  AIAnnotationDataV2,
  WordOutputV2,
  PhraseOutputV2,
  SentenceOutputV2,
} from "@siltflow/shared-lib/types";
import type { AnnotationItem } from "@/stores/annotation.store";

export interface ReviewCardProps {
  item: AnnotationItem;
  answerRevealed: boolean;
  onReveal: () => void;
}

// ── Type guards (mirrors desktop v2.tsx) ─────────────────────────────

function isWordOutput(
  output: AIAnnotationDataV2["output"],
): output is WordOutputV2 {
  return "meanings" in output;
}

function isSentenceOutput(
  output: AIAnnotationDataV2["output"],
): output is SentenceOutputV2 {
  return "translation" in output && !("examples" in output);
}

function isPhraseOutput(
  output: AIAnnotationDataV2["output"],
): output is PhraseOutputV2 {
  return "translation" in output && "examples" in output;
}

// ── Section header ───────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-2 mb-1 mt-3">
      <View className="flex-1" style={{ height: 0.5, backgroundColor: "rgba(128,128,128,0.3)" }} />
      <Text className="text-xs font-medium text-ctp-maroon">{label}</Text>
    </View>
  );
}

// ── Word view ────────────────────────────────────────────────────────

function WordView({
  output,
  lemma,
}: {
  output: WordOutputV2;
  lemma?: string | null;
}) {
  return (
    <View className="gap-1">
      {/* CEFR & Lemma badges */}
      {(output.cefr || lemma) && (
        <View>
          <SectionHeader label="CEFR & Lemma" />
          <View className="flex-row flex-wrap gap-1.5">
            {output.cefr ? (
              <Badge variant="destructive">{output.cefr}</Badge>
            ) : null}
            {lemma ? (
              <Badge variant="warning">{lemma}</Badge>
            ) : null}
          </View>
        </View>
      )}

      {/* Meanings — POS badge + translation in a wrapping row */}
      {output.meanings.length > 0 && (
        <View>
          <SectionHeader label="Meanings" />
          <View className="gap-1">
            {output.meanings.map((m, i) => (
              <View key={i} className="flex-row items-baseline gap-1.5">
                <Badge variant="default">{m.pos}</Badge>
                <Text className="text-lg text-ctp-text flex-1 leading-relaxed">{m.translation}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Definitions */}
      {output.definitions.length > 0 && (
        <View>
          <SectionHeader label="Definitions" />
          <View className="gap-1.5">
            {output.definitions.map((d, i) => (
              <View key={i} className="gap-0.5">
                <View className="flex-row items-baseline gap-1.5">
                  <Badge variant="default">{d.pos}</Badge>
                  <Text className="text-lg text-ctp-text flex-1 leading-relaxed">{d.definition.source}</Text>
                </View>
                {d.definition.target ? (
                  <Text className="text-lg text-ctp-overlay0 leading-relaxed">{d.definition.target}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Examples */}
      {output.examples.length > 0 && (
        <View>
          <SectionHeader label="Examples" />
          <View className="gap-1.5">
            {output.examples.map((ex, i) => (
              <View key={i} className="gap-0.5">
                <Text className="text-lg text-ctp-text leading-relaxed">{ex.sentence}</Text>
                {ex.translation ? (
                  <Text className="text-lg text-ctp-overlay0 leading-relaxed">{ex.translation}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Collocations */}
      {output.collocations.length > 0 && (
        <View>
          <SectionHeader label="Collocations" />
          <View className="gap-1">
            {output.collocations.map((c, i) => (
              <View key={i} className="gap-0.5">
                <Text className="text-lg text-ctp-text leading-relaxed">{c.phrase}</Text>
                <Text className="text-lg text-ctp-overlay0 leading-relaxed">{c.translation}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Synonyms */}
      {output.synonyms.length > 0 && (
        <View>
          <SectionHeader label="Synonyms" />
          <View className="flex-row flex-wrap gap-x-3 gap-y-0.5">
            {output.synonyms.map((s, i) => (
              <Text key={i} className="text-lg text-ctp-text underline leading-relaxed">{s}</Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Phrase view ──────────────────────────────────────────────────────

function PhraseView({ output }: { output: PhraseOutputV2 }) {
  return (
    <View className="gap-1">
      {output.translation ? (
        <View>
          <SectionHeader label="Translation" />
          <Text className="text-lg font-medium text-ctp-text leading-relaxed">
            {output.translation}
          </Text>
        </View>
      ) : null}

      {output.examples.length > 0 && (
        <View>
          <SectionHeader label="Examples" />
          <View className="gap-1.5">
            {output.examples.map((ex, i) => (
              <View key={i} className="gap-0.5">
                <Text className="text-lg text-ctp-text leading-relaxed">{ex.sentence}</Text>
                {ex.translation ? (
                  <Text className="text-lg text-ctp-overlay0 leading-relaxed">{ex.translation}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Sentence view ────────────────────────────────────────────────────

function SentenceView({ output }: { output: SentenceOutputV2 }) {
  if (!output.translation) return null;
  return (
    <View>
      <SectionHeader label="Translation" />
      <Text className="text-lg font-medium text-ctp-text leading-relaxed">
        {output.translation}
      </Text>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function ReviewCard({ item, answerRevealed, onReveal }: ReviewCardProps) {
  const ai = item.aiVersion === 2
    ? (item.aiResult as AIAnnotationDataV2 | undefined)
    : undefined;
  const fsrsCard = item.fsrsCard as {
    state?: number;
    stability?: number;
    difficulty?: number;
    due?: string;
    reps?: number;
    lapses?: number;
    elapsed_days?: number;
    scheduled_days?: number;
  } | undefined;

  const stateLabel = fsrsCard?.state != null
    ? (STATE_LABEL[fsrsCard.state] ?? "New")
    : "New";

  const granularity = ai?.input?.type ?? "word";
  const output = ai?.output;

  // ── Question side (answer not yet revealed) ─────────────────────────

  if (!answerRevealed) {
    return (
      <Pressable onPress={onReveal} className="flex-1">
        <View className="flex-1 rounded-lg border border-ctp-surface0 bg-ctp-base p-6">
          <View className="flex-1 items-center justify-center gap-4">
            {/* Source text — large, centered, wraps */}
            <Text className="text-3xl text-ctp-text text-center leading-relaxed flex-shrink">
              {item.text || "(no text)"}
            </Text>

            {/* State + granularity badges */}
            <View className="flex-row items-center gap-2">
              <Badge variant="secondary">{stateLabel}</Badge>
              <Badge variant="outline">{granularity}</Badge>
            </View>

            <Text className="text-sm text-ctp-overlay0 mt-4">
              Tap to reveal answer
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  // ── Answer side ─────────────────────────────────────────────────────

  return (
    <View className="rounded-lg border border-ctp-surface0 bg-ctp-base p-4">
      <View className="py-2 gap-2">

        {/* ── Header: granularity + kind/page + version ── */}
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center gap-2 flex-1">
            <Text className="text-sm font-medium text-ctp-maroon uppercase tracking-wider">
              {granularity}
            </Text>
            {item.kind === "manual" ? (
              <Badge variant="success">manual</Badge>
            ) : (
              <Text className="text-xs text-ctp-overlay0">p.{item.pageNumber}</Text>
            )}
          </View>
          {item.aiVersion != null && (
            <Badge variant="secondary">v{item.aiVersion}</Badge>
          )}
        </View>

        {/* ── Source text — left blue border, wraps ── */}
        <View className="border-l-2 border-ctp-blue pl-3 mb-1">
          <Text className="text-lg font-semibold text-ctp-text leading-relaxed">
            {ai?.input?.normalized ?? item.text}
          </Text>
        </View>

        {/* ── AI output (V2) ── */}
        {ai && output ? (
          <View className="gap-1">
            {isWordOutput(output) && (
              <WordView output={output} lemma={ai.input.lemma} />
            )}
            {isPhraseOutput(output) && (
              <PhraseView output={output} />
            )}
            {isSentenceOutput(output) && (
              <SentenceView output={output} />
            )}
          </View>
        ) : ai ? (
          /* V1 fallback — simple translation */
          <View className="bg-ctp-mantle rounded-lg p-4 mt-2">
            <Text className="text-sm text-ctp-overlay0 mb-1">Translation</Text>
            <Text className="text-lg text-ctp-text leading-relaxed">
              {(ai as unknown as Record<string, string>).translation ?? "(no translation)"}
            </Text>
          </View>
        ) : null}

        {/* No AI data */}
        {!ai && (
          <Text className="text-sm text-ctp-overlay0 italic mt-2 leading-relaxed">
            No AI translation data available for this card.
          </Text>
        )}

        {/* ── FSRS Card Stats ── */}
        {fsrsCard && (
          <View className="flex-row flex-wrap gap-2 pt-3 mt-1 border-t border-ctp-surface1">
            <Badge variant="secondary">{stateLabel}</Badge>
            {fsrsCard.reps != null && (
              <Badge variant="outline">{fsrsCard.reps} reps</Badge>
            )}
            {fsrsCard.lapses != null && fsrsCard.lapses > 0 && (
              <Badge variant="destructive">{fsrsCard.lapses} lapses</Badge>
            )}
            {fsrsCard.stability != null && fsrsCard.stability > 0 && (
              <Badge variant="outline">{fsrsCard.stability.toFixed(1)}d stability</Badge>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
