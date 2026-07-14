import type { AIProfile } from "../types/ai-profile.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatChunk {
  content: string;
  done: boolean;
}

/**
 * Send a Chat Completions request via the OpenAI SDK (non-streaming).
 * Uses response_format: json_object for structured output.
 */
export async function chatCompletion(
  profile: AIProfile,
  messages: ChatMessage[],
  onChunk: (chunk: ChatChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { OpenAI } = await import("openai");

  const client = new OpenAI({
    baseURL: profile.baseUrl,
    apiKey: profile.apiKey || undefined,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.chat.completions.create(
    {
      model: profile.model,
      messages,
      temperature: profile.temperature,
      max_tokens: profile.maxTokens,
      top_p: profile.topP,
      response_format: { type: "json_object" },
    },
    { signal },
  );

  const choice = response.choices?.[0];
  if (!choice) {
    const msg = JSON.stringify(response, null, 2);
    throw new Error(
      `Empty response from AI model (no choices) — full response: ${msg}`,
    );
  }

  if (choice.finish_reason === "length") {
    throw new Error(
      `AI response truncated (max_tokens=${profile.maxTokens}) — try increasing max tokens`,
    );
  }

  let content = choice.message?.content ?? "";

  // Deep search fallback for providers that nest content differently
  if (!content) {
    const deep =
      (response as any)?.choices?.[0]?.delta?.content ||
      (response as any)?.choices?.[0]?.text ||
      "";
    if (deep) content = deep;
  }

  if (!content) {
    throw new Error(
      `Empty content in AI response (finish_reason: ${choice.finish_reason}) — check your API key and model name`,
    );
  }
  onChunk({ content, done: true });
}
