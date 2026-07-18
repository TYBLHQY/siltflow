export type TTSProvider = "edge-tts" | "mimo";

export interface TTSConfig {
  /** Active TTS provider */
  provider: TTSProvider;
  // ── edge-tts settings ──
  /** Absolute path to edge-tts binary, or "" to search via PATH. */
  binaryPath: string;
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
