import { type AIProfile } from "@/stores/ai.store"

/** Standard Chat Completion request message. */
export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/** Streaming response chunk. */
export interface ChatChunk {
  content: string
  done: boolean
}

/**
 * Send a Chat Completions request via the OpenAI SDK (non-streaming).
 * Uses response_format: json_object for structured output.
 * Returns the full response content string.
 */
export async function chatCompletion(
  profile: AIProfile,
  messages: ChatMessage[],
  onChunk: (chunk: ChatChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { OpenAI } = await import("openai")

  const client = new OpenAI({
    baseURL: profile.baseUrl,
    apiKey: profile.apiKey || undefined,
    dangerouslyAllowBrowser: true,
  })

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
  )

  // Log raw response keys to help debug "empty response" issues
  console.log("[ai] response keys:", Object.keys(response), "id:", response.id)

  const choice = response.choices?.[0]
  if (!choice) {
    const msg = JSON.stringify(response, null, 2)
    console.error("[ai] no choices in response:", msg)
    throw new Error(`Empty response from AI model (no choices) — full response: ${msg}`)
  }

  if (choice.finish_reason === "length") {
    throw new Error(`AI response truncated (max_tokens=${profile.maxTokens}) — try increasing max tokens`)
  }

  const content = choice.message?.content ?? ""
  if (!content) {
    throw new Error(`Empty content in AI response (finish_reason: ${choice.finish_reason}) — check your API key and model name`)
  }
  onChunk({ content, done: true })
}
