import { create } from "zustand"

export interface TTSConfig {
  /** Absolute path to edge-tts binary, or "" to search via PATH. */
  binaryPath: string
  /** Speech rate string, e.g. "+0%", "-10%", "+50%". */
  rate: string
  /** Volume string, e.g. "+0%", "-20%", "+30%". */
  volume: string
  /** Pitch string, e.g. "+0Hz", "-10Hz", "+20Hz". */
  pitch: string
  /** Default voice for general use (usually en-US). */
  defaultVoice: string
  /** Per-language voice overrides: { "zh": "zh-CN-XiaoxiaoNeural", ... } */
  perLanguageVoices: Record<string, string>
  /** Cached voice lists from edge-tts --list-voices, keyed by language id. */
  voiceLists: Record<string, string[]>
  /** Whether auto-TTS after AI translation is enabled. */
  autoTts: boolean
}

interface TTSStoreState {
  config: TTSConfig
  loaded: boolean
  loadingVoices: boolean
  setConfig: (patch: Partial<TTSConfig>) => void
  refreshVoices: () => Promise<void>
  getVoice: (language?: string) => string
}

const STORAGE_KEY = "ttsConfig"

const DEFAULT_CONFIG: TTSConfig = {
  binaryPath: "",
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
  autoTts: false,
}

function persist(config: TTSConfig) {
  window.siltflow.vaultConfigSet({ [STORAGE_KEY]: config })
}

export const useTTSStore = create<TTSStoreState>((set, get) => ({
  config: { ...DEFAULT_CONFIG },
  loaded: false,
  loadingVoices: false,

  setConfig: (patch) =>
    set((s) => {
      const next = { ...s.config, ...patch }
      persist(next)
      return { config: next }
    }),

  refreshVoices: async () => {
    set({ loadingVoices: true })
    try {
      const config = get().config
      const allVoices = await window.siltflow.tts.listVoices(config.binaryPath || undefined)

      // Group by language prefix
      const prefixMap: Record<string, string> = {
        zh: "zh-",
        en: "en-",
        de: "de-",
        ja: "ja-",
        fr: "fr-",
        es: "es-",
      }
      const lists: Record<string, string[]> = {}
      for (const [langId, prefix] of Object.entries(prefixMap)) {
        const filtered = allVoices.filter((v) => v.startsWith(prefix))
        if (filtered.length > 0) lists[langId] = filtered
      }

      set((s) => ({
        config: { ...s.config, voiceLists: lists },
        loadingVoices: false,
      }))
      persist({ ...get().config, voiceLists: lists })
    } catch {
      set({ loadingVoices: false })
    }
  },

  getVoice: (language?: string) => {
    const { config } = get()
    if (language && config.perLanguageVoices[language]) {
      return config.perLanguageVoices[language]
    }
    return config.defaultVoice
  },
}))

/** Call once on app boot to restore TTS config from vault. */
export async function loadTTSConfigFromVault() {
  try {
    const cfg = await window.siltflow.vaultConfigGet()
    const saved = (cfg as Record<string, unknown>)[STORAGE_KEY]
    if (saved && typeof saved === "object") {
      useTTSStore.setState({
        config: { ...DEFAULT_CONFIG, ...(saved as Partial<TTSConfig>) },
        loaded: true,
      })
      return
    }
  } catch { /* ignore */ }
  useTTSStore.setState({ loaded: true })
}
