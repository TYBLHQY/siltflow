/**
 * TTS hook — wraps the singleton TTS service and syncs state via React.
 */
import { useSyncExternalStore } from "react";
import {
  getTTSState,
  onTTSStateChange,
  speakTTS,
  stopTTS,
} from "@/lib/tts";
import type { TTSState } from "@/lib/tts";

export type { TTSState };

export function useTTS() {
  const state = useSyncExternalStore(onTTSStateChange, getTTSState);

  return { state, speak: speakTTS, stop: stopTTS };
}
