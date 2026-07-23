/**
 * Settings / preferences store.
 *
 * Replaces desktop's vault-config JSON file with AsyncStorage for mobile.
 * Covers: AI profiles, FSRS params, TTS config, theme preferences,
 * style settings, and app settings.
 *
 * Install @react-native-async-storage/async-storage before using.
 */

import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────

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
}

interface SettingsState {
  // AI
  aiProfiles: AIProfile[];
  defaultTargetLang: string;

  // App
  checkUpdateOnStartup: boolean;
  hasCompletedOnboarding: boolean;

  // Actions
  setAIProfiles: (profiles: AIProfile[]) => void;
  addAIProfile: (profile: AIProfile) => void;
  updateAIProfile: (id: string, patch: Partial<AIProfile>) => void;
  removeAIProfile: (id: string) => void;
  setDefaultTargetLang: (lang: string) => void;
  setHasCompletedOnboarding: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  aiProfiles: [],
  defaultTargetLang: "zh-CN",
  checkUpdateOnStartup: true,
  hasCompletedOnboarding: false,

  setAIProfiles: (profiles) => set({ aiProfiles: profiles }),

  addAIProfile: (profile) =>
    set((s) => ({ aiProfiles: [...s.aiProfiles, profile] })),

  updateAIProfile: (id, patch) =>
    set((s) => ({
      aiProfiles: s.aiProfiles.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    })),

  removeAIProfile: (id) =>
    set((s) => ({
      aiProfiles: s.aiProfiles.filter((p) => p.id !== id),
    })),

  setDefaultTargetLang: (lang) => set({ defaultTargetLang: lang }),

  setHasCompletedOnboarding: (v) => set({ hasCompletedOnboarding: v }),
}));
