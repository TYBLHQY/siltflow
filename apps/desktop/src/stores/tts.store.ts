import { create } from "zustand";

export type TTSProvider = "edge-tts" | "mimo";

export interface TTSConfig {
  /** Active TTS provider */
  provider: TTSProvider;
  // ── edge-tts settings ──
  /** Speech rate string, e.g. "+0%", "-10%", "+50%". */
  rate: string;
  /** Volume string, e.g. "+0%", "-20%", "+30%". */
  volume: string;
  /** Pitch string, e.g. "+0Hz", "-10Hz", "+20Hz". */
  pitch: string;
  /** Default voice for general use (usually en-US). */
  defaultVoice: string;
  /** Per-language voice overrides: { "zh": "zh-CN-XiaoxiaoNeural", ... } */
  perLanguageVoices: Record<string, string>;
  /** Cached voice lists from edge-tts --list-voices, keyed by language id. */
  voiceLists: Record<string, string[]>;
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
  setConfig: (patch: Partial<TTSConfig>) => void;
  refreshVoices: () => Promise<void>;
  getVoice: (language?: string) => string;
}

const STORAGE_KEY = "ttsConfig";

const DEFAULT_CONFIG: TTSConfig = {
  provider: "edge-tts",
  rate: "+0%",
  volume: "+0%",
  pitch: "+0Hz",
  defaultVoice: "en-US-EmmaMultilingualNeural",
  perLanguageVoices: {
    zh: "zh-CN-XiaoxiaoNeural",
    en: "en-US-EmmaMultilingualNeural",
    de: "de-DE-KatjaNeural",
    ja: "ja-JP-NanamiNeural",
    fr: "fr-FR-DeniseNeural",
    es: "es-ES-ElviraNeural",
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
      const allVoices = await window.siltflow.tts.listVoices();

      // Group by language prefix
      const prefixMap: Record<string, string> = {
        zh: "zh-",
        en: "en-",
        de: "de-",
        ja: "ja-",
        fr: "fr-",
        es: "es-",
      };
      const lists: Record<string, string[]> = {};
      for (const [langId, prefix] of Object.entries(prefixMap)) {
        const filtered = allVoices.filter((v: string) => v.startsWith(prefix));
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

    // 匹配顺序：先精确匹配，再取 ISO 639-1 前缀匹配
    if (language) {
      if (config.perLanguageVoices[language]) {
        return config.perLanguageVoices[language];
      }
      const shortCode = language.split("-")[0];
      if (shortCode && config.perLanguageVoices[shortCode]) {
        return config.perLanguageVoices[shortCode];
      }
    }

    // 如果没有 language 参数，也尝试用 defaultVoice 的 locale 前缀去匹配 perLanguageVoices
    const defShortCode = config.defaultVoice?.split("-")[0];
    if (defShortCode && config.perLanguageVoices[defShortCode]) {
      return config.perLanguageVoices[defShortCode];
    }

    return config.defaultVoice;
  },
}));

/** Call once on app boot to restore TTS config from vault. */
export async function loadTTSConfigFromVault() {
  try {
    const cfg = await window.siltflow.vaultConfigGet();
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
