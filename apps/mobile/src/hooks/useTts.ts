/**
 * TTS hook — wraps the singleton TTS service and syncs state via React.
 *
 * Same API as desktop `hooks/useTts.ts`.
 *
 * Usage:
 *   const tts = useTTS();
 *   tts.speak("Hello world", undefined, "en-US", itemId);
 *   // tts.state === "loading" | "playing" | "idle" | "error"
 *   // tts.speakingId === itemId (while playing)
 */

import { useSyncExternalStore } from "react";
import {
  getTTSStatus,
  onTTSStateChange,
  speakTTS,
  stopTTS,
} from "@/lib/tts";

export function useTTS() {
  const { state, speakingId } = useSyncExternalStore(
    onTTSStateChange,
    getTTSStatus,
  );

  return { state, speakingId, speak: speakTTS, stop: stopTTS };
}
