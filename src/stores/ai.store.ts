import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A provider profile — an instance of a provider with user-specified config. */
export interface AIProfile {
  id: string;
  /** User-given name (defaults to provider label on create) */
  name: string;
  /** Provider preset key, or "custom" for user-defined */
  providerKey: string;
  /** API base URL */
  baseUrl: string;
  /** API key */
  apiKey: string;
  /** Model name */
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  /** Whether this profile is the active one */
  active: boolean;
}

/** Built-in provider preset. */
export interface ProviderPreset {
  key: string;
  label: string;
  baseUrl: string;
  /** Suggested default model — user can override */
  defaultModel: string;
  /** Whether a user can create this (vs built-in-placeholder) */
  editable?: boolean;
}

// ---------------------------------------------------------------------------
// Built-in provider presets
// ---------------------------------------------------------------------------

export const BUILTIN_PROVIDERS: ProviderPreset[] = [
  {
    key: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  {
    key: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
  },
  {
    key: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  },
  {
    key: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
  },
  {
    key: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
  },
  {
    key: "xai",
    label: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-2-latest",
  },
  {
    key: "mistral",
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
  },
  {
    key: "together",
    label: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  },
  {
    key: "fireworks",
    label: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/llama-v3p2-3b-instruct",
  },
  {
    key: "cerebras",
    label: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama3.1-8b",
  },
  {
    key: "perplexity",
    label: "Perplexity",
    baseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar-pro",
  },
  {
    key: "qwen",
    label: "Alibaba Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
  },
  {
    key: "deepinfra",
    label: "DeepInfra",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    defaultModel: "meta-llama/Meta-Llama-3.1-8B-Instruct",
  },
  {
    key: "sambanova",
    label: "SambaNova",
    baseUrl: "https://api.sambanova.ai/v1",
    defaultModel: "Meta-Llama-3.1-8B-Instruct",
  },
  {
    key: "ollama",
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
  },
  {
    key: "lmstudio",
    label: "LM Studio (local)",
    baseUrl: "http://localhost:1234/v1",
    defaultModel: "local-model",
  },
  {
    key: "custom",
    label: "Custom",
    baseUrl: "",
    defaultModel: "",
    editable: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genId(): string {
  return (
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

function createProfile(preset: ProviderPreset, idx: number): AIProfile {
  const label = preset.editable
    ? preset.key
    : `${preset.label} ${idx > 0 ? idx : ""}`.trim();
  return {
    id: genId(),
    name: label,
    providerKey: preset.key,
    baseUrl: preset.baseUrl,
    apiKey: "",
    model: preset.defaultModel,
    temperature: 0.3,
    maxTokens: 393_216,
    topP: 1,
    active: false,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AIStoreState {
  /** Whether the initial load from vault has completed */
  loaded: boolean;
  profiles: AIProfile[];
  defaultTargetLang: string;
  addProfile: (providerKey: string) => void;
  removeProfile: (id: string) => void;
  updateProfile: (id: string, patch: Partial<AIProfile>) => void;
  setActiveProfile: (id: string) => void;
  setDefaultTargetLang: (lang: string) => void;
  /** Get the currently-active profile, or null if none */
  activeProfile: () => AIProfile | null;
}

export const useAIStore = create<AIStoreState>()((set, get) => ({
  loaded: false,
  profiles: [],
  defaultTargetLang: "zh-CN",

  addProfile: (providerKey: string) => {
    const preset = BUILTIN_PROVIDERS.find((p) => p.key === providerKey);
    if (!preset) return;
    const existing = get().profiles.filter(
      (p) => p.providerKey === providerKey,
    );
    const profile = createProfile(preset, existing.length);
    set((s) => {
      const next = [...s.profiles, profile];
      persistToVault(next);
      return { profiles: next };
    });
  },

  removeProfile: (id: string) =>
    set((s) => {
      const next = s.profiles.filter((p) => p.id !== id);
      persistToVault(next);
      return { profiles: next };
    }),

  updateProfile: (id: string, patch: Partial<AIProfile>) =>
    set((s) => {
      const next = s.profiles.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      );
      persistToVault(next);
      return { profiles: next };
    }),

  setActiveProfile: (id: string) =>
    set((s) => {
      const next = s.profiles.map((p) => ({ ...p, active: p.id === id }));
      persistToVault(next);
      return { profiles: next };
    }),

  activeProfile: () => {
    const profiles = get().profiles;
    return profiles.find((p) => p.active) ?? profiles[0] ?? null;
  },

  setDefaultTargetLang: (lang) => {
    set({ defaultTargetLang: lang });
    window.siltflow.vaultConfigSet({ defaultTargetLang: lang });
  },
}));

// ---------------------------------------------------------------------------
// Vault persistence
// ---------------------------------------------------------------------------

const AI_VAULT_KEY = "aiStore";

function persistToVault(profiles: AIProfile[]) {
  window.siltflow.vaultConfigSet({ [AI_VAULT_KEY]: profiles });
}

/** Call once on app boot to restore profiles and settings from vault. */
export function loadFromVault(cfg?: Record<string, unknown>) {
  if (cfg) return applyAIConfig(cfg);
  // fallback: loads config independently (e.g. when called directly)
  window.siltflow.vaultConfigGet().then(applyAIConfig).catch(() => {});
}

function applyAIConfig(cfg: Record<string, unknown>) {
  const saved = (cfg as Record<string, unknown>)[AI_VAULT_KEY];
  if (Array.isArray(saved)) {
    useAIStore.setState({ profiles: saved as AIProfile[], loaded: true });
  }
  const defaultTargetLang = (cfg as Record<string, unknown>)[
    "defaultTargetLang"
  ] as string | undefined;
  if (defaultTargetLang) {
    useAIStore.setState({ defaultTargetLang });
  }
  useAIStore.setState({ loaded: true });
}
