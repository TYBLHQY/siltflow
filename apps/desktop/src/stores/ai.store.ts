import { create } from "zustand";
import type { AIProfile, AITask, ProviderPreset } from "@/types/ai";
export type { AIProfile, AITask, ProviderPreset } from "@/types/ai";
import { BUILTIN_PROVIDERS } from "@/constants/providers";

// Re-export for backward compatibility
export { BUILTIN_PROVIDERS };

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
  };
}

// ---------------------------------------------------------------------------
// Task labels (for UI)
// ---------------------------------------------------------------------------

export const TASK_LABELS: Record<AITask, string> = {
  summarize: "Summarize",
  "translate-input": "Translate (Input)",
  "translate-output": "Translate (Output)",
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AIStoreState {
  /** Whether the initial load from vault has completed */
  loaded: boolean;
  profiles: AIProfile[];
  /** Maps each AI task to a profile id (null = unassigned → fallback to first profile). */
  taskProfiles: Partial<Record<AITask, string | null>>;
  defaultTargetLang: string;
  addProfile: (providerKey: string) => void;
  removeProfile: (id: string) => void;
  updateProfile: (id: string, patch: Partial<AIProfile>) => void;
  /** Assign a profile to a task (null to unassign). */
  setTaskProfile: (task: AITask, profileId: string | null) => void;
  /** Get the profile assigned to a given task, or the first profile as fallback. */
  getProfileForTask: (task: AITask) => AIProfile | null;
  setDefaultTargetLang: (lang: string) => void;
}

export const useAIStore = create<AIStoreState>()((set, get) => ({
  loaded: false,
  profiles: [],
  taskProfiles: {},
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
      persistToVault(next, s.taskProfiles);
      return { profiles: next };
    });
  },

  removeProfile: (id: string) =>
    set((s) => {
      const next = s.profiles.filter((p) => p.id !== id);
      // Clean up any task assignments pointing to the removed profile
      const taskProfiles = { ...s.taskProfiles };
      for (const [task, pid] of Object.entries(taskProfiles)) {
        if (pid === id) taskProfiles[task as AITask] = null;
      }
      persistToVault(next, taskProfiles);
      return { profiles: next, taskProfiles };
    }),

  updateProfile: (id: string, patch: Partial<AIProfile>) =>
    set((s) => {
      const next = s.profiles.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      );
      persistToVault(next, s.taskProfiles);
      return { profiles: next };
    }),

  setTaskProfile: (task: AITask, profileId: string | null) =>
    set((s) => {
      const next = { ...s.taskProfiles, [task]: profileId };
      persistToVault(s.profiles, next);
      return { taskProfiles: next };
    }),

  getProfileForTask: (task: AITask) => {
    const { profiles, taskProfiles } = get();
    const profileId = taskProfiles[task];
    if (profileId) {
      const found = profiles.find((p) => p.id === profileId);
      if (found) return found;
    }
    // Fallback: first profile
    return profiles[0] ?? null;
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
const TASK_PROFILES_KEY = "taskProfiles";

function persistToVault(
  profiles: AIProfile[],
  taskProfiles: Partial<Record<AITask, string | null>>,
) {
  window.siltflow.vaultConfigSet({
    [AI_VAULT_KEY]: profiles,
    [TASK_PROFILES_KEY]: taskProfiles,
  });
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
    // Migrate legacy profiles: strip active/task fields
    const migrated = (saved as Array<Record<string, unknown>>).map(
      ({ active: _active, task: _task, ...rest }) => rest as unknown as AIProfile,
    );
    useAIStore.setState({ profiles: migrated, loaded: true });
  }
  const taskProfiles = (cfg as Record<string, unknown>)[
    TASK_PROFILES_KEY
  ] as Partial<Record<AITask, string | null>> | undefined;
  if (taskProfiles) {
    useAIStore.setState({ taskProfiles });
  }
  const defaultTargetLang = (cfg as Record<string, unknown>)[
    "defaultTargetLang"
  ] as string | undefined;
  if (defaultTargetLang) {
    useAIStore.setState({ defaultTargetLang });
  }
  useAIStore.setState({ loaded: true });
}
