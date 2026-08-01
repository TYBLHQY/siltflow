/**
 * Text granularity inference for the V2 translate pipeline.
 *
 * The input AI receives a type hint ("word" | "phrase" | "sentence") so it can
 * pick the right output schema. The hint is derived heuristically from the
 * selected text before the AI call.
 */

export function inferGranularity(text: string): "word" | "phrase" | "sentence" {
  const t = text.trim();
  if (t.includes("\n") || t.split(" ").length > 30) return "sentence";
  if (t.split(/[.!?;]+/).filter(Boolean).length > 1) return "sentence";
  if (t.split(" ").length > 2) return "phrase";
  return "word";
}
