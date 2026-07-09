import type { AIConfig } from "@/stores/ai.store"

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

function buildHeaders(config: AIConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`
  }
  return headers
}

function buildBody(config: AIConfig, messages: ChatMessage[]) {
  return {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    top_p: config.topP,
    stream: true,
  }
}

/**
 * Send a streaming Chat Completions request via fetch + ReadableStream.
 * Each chunk is yielded via the callback; the promise resolves when done.
 */
export async function chatCompletion(
  config: AIConfig,
  messages: ChatMessage[],
  onChunk: (chunk: ChatChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(config),
    body: JSON.stringify(buildBody(config, messages)),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("Response body is not readable (stream not supported)")

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith("data: ")) continue
      const payload = trimmed.slice(6)
      if (payload === "[DONE]") {
        onChunk({ content: "", done: true })
        return
      }
      try {
        const parsed = JSON.parse(payload)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) {
          onChunk({ content: delta, done: false })
        }
        // If finish_reason is present, this is the last chunk with content
        if (parsed.choices?.[0]?.finish_reason) {
          onChunk({ content: "", done: true })
          return
        }
      } catch {
        // Partial JSON line — skip
      }
    }
  }

  // Stream ended without [DONE]
  onChunk({ content: "", done: true })
}
