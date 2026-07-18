import { create } from "zustand";
import type { TTSConfig } from "@/types/tts";
export type { TTSProvider, TTSConfig } from "@/types/tts";

interface TTSStoreState {
  config: TTSConfig;
  loaded: boolean;
  loadingVoices: boolean;
  setConfig: (patch: Partial<TTSConfig>) => void;
  refreshVoices: () => Promise<void>;
  getVoice: (language?: string) => string;
}

const STORAGE_KEY = "ttsConfig";

const DEFAULT_CONFIG: TTSConfig = {
  provider: "edge-tts",
  binaryPath: "",
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
  voiceLists: {},
  mimoApiKey: "",
  mimoVoice: "冰糖",
  mimoModel: "mimo-v2.5-tts",
  mimoStylePrompt: "",
  mimoInlineTag: "",
};

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
  {
    id: "mimo-v2.5-tts-voicedesign",
    label: "mimo-v2.5-tts-voicedesign (Voice design)",
  },
  {
    id: "mimo-v2.5-tts-voiceclone",
    label: "mimo-v2.5-tts-voiceclone (Voice clone)",
  },
];

function persist(config: TTSConfig) {
  window.siltflow.vaultConfigSet({ [STORAGE_KEY]: config });
}

export const useTTSStore = create<TTSStoreState>((set, get) => ({
  config: { ...DEFAULT_CONFIG },
  loaded: false,
  loadingVoices: false,

  setConfig: (patch) =>
    set((s) => {
      const next = { ...s.config, ...patch };
      persist(next);
      return { config: next };
    }),

  refreshVoices: async () => {
    set({ loadingVoices: true });
    try {
      const config = get().config;
      const allVoices = await window.siltflow.tts.listVoices(
        config.binaryPath || undefined,
      );

      // Group by BCP 47 primary subtag prefix
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
        const filtered = allVoices.filter((v) => v.startsWith(prefix));
        if (filtered.length > 0) lists[langId] = filtered;
      }

      const current = get().config;
      const next = { ...current, voiceLists: lists };
      persist(next);
      set({ config: next, loadingVoices: false });
    } catch {
      set({ loadingVoices: false });
    }
  },

  getVoice: (language?: string) => {
    const { config } = get();
    if (config.provider === "mimo") return config.mimoVoice;
    if (language) {
      // Exact BCP 47 match: "en-US" → "en-US-EmmaMultilingualNeural"
      if (config.perLanguageVoices[language]) return config.perLanguageVoices[language];
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

/** Call once on app boot to restore TTS config from vault. */
export async function loadTTSConfigFromVault(cfg?: Record<string, unknown>) {
  try {
    if (!cfg) cfg = await window.siltflow.vaultConfigGet();
    const saved = (cfg as Record<string, unknown>)[STORAGE_KEY];
    if (saved && typeof saved === "object") {
      useTTSStore.setState({
        config: { ...DEFAULT_CONFIG, ...(saved as Partial<TTSConfig>) },
        loaded: true,
      });
      return;
    }
  } catch {
    /* ignore */
  }
  useTTSStore.setState({ loaded: true });
}
