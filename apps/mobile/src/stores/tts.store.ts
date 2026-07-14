import { create } from "zustand";

export type TTSProvider = "edge-tts" | "mimo";

export interface TTSConfig {
  provider: TTSProvider;
  rate: string;
  volume: string;
  pitch: string;
  defaultVoice: string;
  perLanguageVoices: Record<string, string>;
  voiceLists: Record<string, string[]>;
  mimoApiKey: string;
  mimoVoice: string;
  mimoModel: string;
  mimoStylePrompt: string;
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

const STORAGE_KEY = "tts_config";

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

async function persist(config: TTSConfig) {
  try {
    const { configSet } = await import("../config");
    await configSet(STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
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
      const { listVoices } = await import("@siltflow/edge-tts");
      const allVoices = await listVoices();
      const shortNames = allVoices.map((v: any) => v.ShortName);

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
        const filtered = shortNames.filter((v: string) => v.startsWith(prefix));
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
      if (config.perLanguageVoices[language]) {
        return config.perLanguageVoices[language];
      }
      const shortCode = language.split("-")[0];
      if (shortCode && config.perLanguageVoices[shortCode]) {
        return config.perLanguageVoices[shortCode];
      }
    }

    const defShortCode = config.defaultVoice?.split("-")[0];
    if (defShortCode && config.perLanguageVoices[defShortCode]) {
      return config.perLanguageVoices[defShortCode];
    }

    return config.defaultVoice;
  },
}));

export async function loadTTSConfigFromConfig() {
  try {
    const { configGetAll } = await import("../config");
    const cfg = await configGetAll();
    const saved = cfg[STORAGE_KEY];
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<TTSConfig>;
      useTTSStore.setState({
        config: { ...DEFAULT_CONFIG, ...parsed },
        loaded: true,
      });
      return;
    }
  } catch { /* ignore */ }
  useTTSStore.setState({ loaded: true });
}
