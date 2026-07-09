import { create } from "zustand"

/**
 * OpenAI Chat Completions API configuration.
 * Persisted to localStorage with key "siltflow-ai-config".
 */
export interface AIConfig {
  /** API base URL, e.g. "https://api.openai.com/v1" */
  baseUrl: string
  /** API key */
  apiKey: string
  /** Model name, e.g. "gpt-4o-mini" */
  model: string
  /** Temperature (0-2) */
  temperature: number
  /** Max tokens in the response */
  maxTokens: number
  /** Top-p sampling */
  topP: number
  /** System prompt prefix */
  systemPrompt: string
}

const STORAGE_KEY = "siltflow-ai-config"

const defaults: AIConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.3,
  maxTokens: 512,
  topP: 1,
  systemPrompt: "You are a helpful translation assistant. Translate the given text naturally while preserving meaning. If context is provided, use it to disambiguate.",
}

function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...defaults }
}

function saveConfig(config: AIConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

interface AIStoreState {
  config: AIConfig
  updateConfig: (patch: Partial<AIConfig>) => void
  resetConfig: () => void
}

export const useAIStore = create<AIStoreState>((set) => ({
  config: loadConfig(),
  updateConfig: (patch) =>
    set((s) => {
      const next = { ...s.config, ...patch }
      saveConfig(next)
      return { config: next }
    }),
  resetConfig: () => {
    const next = { ...defaults }
    saveConfig(next)
    set({ config: next })
  },
}))
