/**
 * TTS hook — wraps the singleton TTS service and syncs state via React.
 */
import { useSyncExternalStore } from "react";
import {
  getTTSStatus,
  onTTSStateChange,
  speakTTS,
  stopTTS,
} from "@/lib/tts";

export function useTTS() {
  const { state, speakingId } = useSyncExternalStore(onTTSStateChange, getTTSStatus);

  return { state, speakingId, speak: speakTTS, stop: stopTTS };
}
