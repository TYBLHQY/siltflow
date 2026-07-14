import { create } from "zustand";

// Inline types — @siltflow/shared/ai doesn't export AIProfile/BUILTIN_PROVIDERS

export interface ProviderPreset {
  key: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  editable?: boolean;
}

export const BUILTIN_PROVIDERS: ProviderPreset[] = [
  { key: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
  { key: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com", defaultModel: "deepseek-v4-flash" },
  { key: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  { key: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini" },
  { key: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.0-flash" },
  { key: "ollama", label: "Ollama (local)", baseUrl: "http://localhost:11434/v1", defaultModel: "llama3.2" },
  { key: "custom", label: "Custom", baseUrl: "", defaultModel: "", editable: true },
];

export interface AIProfile {
  id: string;
  name: string;
  providerKey: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  active: boolean;
}

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

interface AIStoreState {
  loaded: boolean;
  profiles: AIProfile[];
  defaultTargetLang: string;
  addProfile: (providerKey: string) => void;
  removeProfile: (id: string) => void;
  updateProfile: (id: string, patch: Partial<AIProfile>) => void;
  setActiveProfile: (id: string) => void;
  activeProfile: () => AIProfile | null;
  setDefaultTargetLang: (lang: string) => void;
}

const CONFIG_KEY = "ai_store";

async function persist(profiles: AIProfile[]) {
  try {
    const { configSet } = await import("../config");
    await configSet(CONFIG_KEY, JSON.stringify(profiles));
  } catch { /* ignore */ }
}

export const useAIStore = create<AIStoreState>()((set, get) => ({
  loaded: false,
  profiles: [],
  defaultTargetLang: "zh",

  addProfile: (providerKey: string) => {
    const preset = BUILTIN_PROVIDERS.find((p) => p.key === providerKey);
    if (!preset) return;
    const existing = get().profiles.filter(
      (p) => p.providerKey === providerKey,
    );
    const profile = createProfile(preset, existing.length);
    set((s) => {
      const next = [...s.profiles, profile];
      persist(next);
      return { profiles: next };
    });
  },

  removeProfile: (id: string) =>
    set((s) => {
      const next = s.profiles.filter((p) => p.id !== id);
      persist(next);
      return { profiles: next };
    }),

  updateProfile: (id: string, patch: Partial<AIProfile>) =>
    set((s) => {
      const next = s.profiles.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      );
      persist(next);
      return { profiles: next };
    }),

  setActiveProfile: (id: string) =>
    set((s) => {
      const next = s.profiles.map((p) => ({ ...p, active: p.id === id }));
      persist(next);
      return { profiles: next };
    }),

  activeProfile: () => {
    const profiles = get().profiles;
    return profiles.find((p) => p.active) ?? profiles[0] ?? null;
  },

  setDefaultTargetLang: async (lang) => {
    set({ defaultTargetLang: lang });
    try {
      const { configSet } = await import("../config");
      await configSet("defaultTargetLang", lang);
    } catch { /* ignore */ }
  },
}));

export async function loadFromConfig() {
  try {
    const { configGetAll } = await import("../config");
    const cfg = await configGetAll();
    const saved = cfg[CONFIG_KEY];
    if (saved) {
      const profiles = JSON.parse(saved) as AIProfile[];
      if (Array.isArray(profiles)) {
        useAIStore.setState({ profiles, loaded: true });
      }
    }
    const defaultTargetLang = cfg["defaultTargetLang"];
    if (defaultTargetLang) {
      useAIStore.setState({ defaultTargetLang });
    }
    useAIStore.setState({ loaded: true });
    return;
  } catch { /* ignore */ }
  useAIStore.setState({ loaded: true });
}
