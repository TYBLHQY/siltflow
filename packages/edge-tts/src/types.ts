/** Supported rate/volume/pitch config values */
export interface CommunicateOptions {
  /** Voice name, e.g. "en-US-EmmaMultilingualNeural" */
  voice?: string;
  /** Speech rate string, e.g. "+0%", "-50%", "+100%" */
  rate?: string;
  /** Volume string, e.g. "+0%", "-50%", "+100%" */
  volume?: string;
  /** Pitch string, e.g. "+0Hz", "-50Hz", "+100Hz" */
  pitch?: string;
  /** Emit WordBoundary events during streaming */
  wordBoundary?: boolean;
  /** Emit SentenceBoundary events during streaming */
  sentenceBoundary?: boolean;
  /** HTTP proxy URL (Node.js only) */
  proxy?: string;
  /**
   * WebSocket constructor override.
   * - React Native / browsers: omit (uses globalThis.WebSocket)
   * - Electron / Node < 21: pass the `ws` module's constructor
   */
  wsImpl?: { new(url: string): WebSocket };
}

/** A single chunk from the edge-tts stream */
export type TTSChunk =
  | { type: "audio"; data: Uint8Array }
  | {
      type: "WordBoundary" | "SentenceBoundary";
      offset: number;
      duration: number;
      text: string;
    };

/** Voice metadata from the Microsoft Edge TTS endpoint */
export interface Voice {
  Name: string;
  ShortName: string;
  Gender: "Female" | "Male";
  Locale: string;
  SuggestedCodec: string;
  FriendlyName: string;
  Status: string;
  VoiceTag: {
    ContentCategories: string[];
    VoicePersonalities: string[];
  };
}

/** Internal: parsed WebSocket binary frame */
export interface ParsedWsMessage {
  headers: Record<string, string>;
  data: Uint8Array;
}
