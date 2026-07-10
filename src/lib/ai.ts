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
 * Send a streaming Chat Completions request via the OpenAI SDK.
 * Uses response_format: json_object for structured output.
 */
export async function chatCompletion(
  profile: AIProfile,
  messages: ChatMessage[],
  onChunk: (chunk: ChatChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Dynamic import so the SDK is lazy-loaded only on first AI call
  const { OpenAI } = await import("openai")

  const client = new OpenAI({
    baseURL: profile.baseUrl,
    apiKey: profile.apiKey || undefined,
    dangerouslyAllowBrowser: true,
  })

  const stream = await client.chat.completions.create(
    {
      model: profile.model,
      messages,
      temperature: profile.temperature,
      max_tokens: profile.maxTokens,
      top_p: profile.topP,
      stream: true,
      response_format: { type: "json_object" },
    },
    { signal },
  )

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content
    if (delta && delta !== null) {
      onChunk({ content: delta, done: false })
    }
    if (chunk.choices?.[0]?.finish_reason) {
      break
    }
  }

  onChunk({ content: "", done: true })
}
