/**
 * TTS configuration store (mobile).
 *
 * Mirrors desktop `stores/tts.store.ts` API but:
 *  - No `binaryPath` — mobile goes through sync-server proxy.
 *  - No `voiceLists` cache — voices are fetched on-demand via
 *    sync-server's GET /api/tts/voices.
 *  - Persisted via MMKV in the future; currently ephemeral (resets on cold start).
 *
 * Same public interface: `provider`, `rate`, `volume`, `pitch`, `defaultVoice`,
 * `perLanguageVoices`, `mimo*`, `setConfig()`, `getVoice()`, `refreshVoices()`.
 */

import { create } from "zustand";
import { useSyncStore } from "@/stores/sync.store";

// ── Types ───────────────────────────────────────────────────────────────

export type TTSProvider = "edge-tts" | "mimo";

export interface TTSConfig {
  /** Active TTS provider */
  provider: TTSProvider;
  /** Speech rate string, e.g. "+0%", "-10%", "+50%". */
  rate: string;
  /** Volume string, e.g. "+0%", "-20%", "+30%". */
  volume: string;
  /** Pitch string, e.g. "+0Hz", "-10Hz", "+20Hz". */
  pitch: string;
  /** Default voice for general use (usually en-US). */
  defaultVoice: string;
  /** Per-language voice overrides: { "zh-CN": "zh-CN-XiaoxiaoNeural", ... } */
  perLanguageVoices: Record<string, string>;
  // ── MiMo settings ──
  /** MiMo API key */
  mimoApiKey: string;
  /** MiMo voice ID (e.g. "冰糖", "Chloe") */
  mimoVoice: string;
  /** MiMo model */
  mimoModel: string;
  /** MiMo style — natural language tone instruction (sent in user role) */
  mimoStylePrompt: string;
  /** MiMo inline audio tags — inserted at start of assistant content (e.g. "(温柔)") */
  mimoInlineTag: string;
}

interface TTSStoreState {
  config: TTSConfig;
  loaded: boolean;
  loadingVoices: boolean;
  voiceLists: Record<string, string[]>;
  setConfig: (patch: Partial<TTSConfig>) => void;
  refreshVoices: () => Promise<void>;
  getVoice: (language?: string) => string;
}

// ── Defaults ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: TTSConfig = {
  provider: "edge-tts",
  rate: "+0%",
  volume: "+0%",
  pitch: "+0Hz",
  defaultVoice: "en-US-EmmaMultilingualNeural",
  perLanguageVoices: {
    "zh-CN": "zh-CN-XiaoxiaoNeural",
    "en-US": "en-US-EmmaMultilingualNeural",
    "de-DE": "de-DE-KatjaNeural",
    "ja-JP": "ja-JP-NanamiNeural",
    "fr-FR": "fr-FR-DeniseNeural",
    "es-ES": "es-ES-ElviraNeural",
  },
  mimoApiKey: "",
  mimoVoice: "冰糖",
  mimoModel: "mimo-v2.5-tts",
  mimoStylePrompt: "",
  mimoInlineTag: "",
};

// ── Constants (mirrors desktop) ─────────────────────────────────────────

export const MIMO_PRESET_VOICES = [
  { id: "冰糖", label: "冰糖 (Chinese, Female)" },
  { id: "茉莉", label: "茉莉 (Chinese, Female)" },
  { id: "苏打", label: "苏打 (Chinese, Male)" },
  { id: "白桦", label: "白桦 (Chinese, Male)" },
  { id: "Mia", label: "Mia (English, Female)" },
  { id: "Chloe", label: "Chloe (English, Female)" },
  { id: "Milo", label: "Milo (English, Male)" },
  { id: "Dean", label: "Dean (English, Male)" },
];

export const MIMO_MODELS = [
  { id: "mimo-v2.5-tts", label: "mimo-v2.5-tts (Preset voices)" },
  { id: "mimo-v2.5-tts-voicedesign", label: "mimo-v2.5-tts-voicedesign (Voice design)" },
  { id: "mimo-v2.5-tts-voiceclone", label: "mimo-v2.5-tts-voiceclone (Voice clone)" },
];

// ── Store ───────────────────────────────────────────────────────────────

export const useTTSStore = create<TTSStoreState>((set, get) => ({
  config: { ...DEFAULT_CONFIG },
  loaded: false,
  loadingVoices: false,
  voiceLists: {},

  setConfig: (patch) =>
    set((s) => ({
      config: { ...s.config, ...patch },
    })),

  refreshVoices: async () => {
    set({ loadingVoices: true });
    try {
      const syncConfig = useSyncStore.getState().config;
      if (!syncConfig.syncEnabled || !syncConfig.deviceToken || !syncConfig.serverUrl) {
        set({ loadingVoices: false });
        return;
      }

      const response = await fetch(
        `${syncConfig.serverUrl}/api/tts/voices`,
        {
          headers: {
            Authorization: `Bearer ${syncConfig.deviceToken}`,
          },
        },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const groups = (data as { groups?: Record<string, string[]> }).groups ?? {};

      // Build per-language lists from server response
      const prefixMap: Record<string, string> = {
        "zh-CN": "zh-",
        "en-US": "en-",
        "de-DE": "de-",
        "ja-JP": "ja-",
        "fr-FR": "fr-",
        "es-ES": "es-",
      };
      const lists: Record<string, string[]> = {};
      for (const [langId, prefix] of Object.entries(prefixMap)) {
        const filtered = groups[langId] && groups[langId].length > 0
          ? groups[langId]
          : Object.values(groups).flat().filter((v: string) => v.startsWith(prefix));
        if (filtered.length > 0) lists[langId] = filtered;
      }

      set({ voiceLists: lists, loadingVoices: false });
    } catch {
      set({ loadingVoices: false });
    }
  },

  getVoice: (language?: string) => {
    const { config } = get();
    if (config.provider === "mimo") return config.mimoVoice;
    if (language) {
      // Exact BCP 47 match: "en-US" → "en-US-EmmaMultilingualNeural"
      if (config.perLanguageVoices[language])
        return config.perLanguageVoices[language];
      // Prefix match: "en" / "en-GB" → "en-US-EmmaMultilingualNeural"
      const primary = language.split("-")[0];
      const match = Object.keys(config.perLanguageVoices).find((k) =>
        k.startsWith(primary),
      );
      if (match) return config.perLanguageVoices[match];
    }
    return config.defaultVoice;
  },
}));
