/**
 * Singleton TTS service.
 *
 * Share a single Audio instance and playback state across all callers,
 * so `AIAnnotationResult` (internal) and `StudyPanel` (shortcut callback)
 * use exactly the same TTS session.
 */

import { useTTSStore } from "@/stores/tts.store";

export type TTSState = "idle" | "loading" | "playing" | "error";

export interface TTSStatus {
  state: TTSState;
  /** ID of the annotation item that started this playback, if any. */
  speakingId: string | null;
}

const MIMO_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";

// ── Module-level state & audio ref ──
let state: TTSState = "idle";
let speakingId: string | null = null;
let audioRef: HTMLAudioElement | null = null;
const listeners = new Set<(s: TTSStatus) => void>();

// Cache the last TTSStatus so useSyncExternalStore gets a stable reference.
let cachedStatus: TTSStatus = { state: "idle", speakingId: null };

function setState(next: TTSState) {
  state = next;
  if (next === "idle" || next === "error") speakingId = null;
  cachedStatus = { state, speakingId };
  listeners.forEach((fn) => fn(cachedStatus));
}

/** Subscribe to state changes. Returns unsubscribe fn. */
export function onTTSStateChange(fn: (s: TTSStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTTSStatus(): TTSStatus {
  return cachedStatus;
}

// ── MiMo body builder ──

function buildMimoBody(
  config: ReturnType<typeof useTTSStore.getState>["config"],
  voice: string,
  text: string,
) {
  const messages: { role: string; content: string }[] = [];
  if (config.mimoStylePrompt?.trim()) {
    messages.push({ role: "user", content: config.mimoStylePrompt.trim() });
  }
  let assistantContent = text;
  if (config.mimoInlineTag?.trim()) {
    assistantContent = `${config.mimoInlineTag.trim()}${text}`;
  }
  messages.push({ role: "assistant", content: assistantContent });
  return {
    model: config.mimoModel,
    messages,
    audio: { format: "wav", voice },
  };
}

// ── Public API ──

export function stopTTS() {
  if (audioRef) {
    audioRef.pause();
    audioRef.src = "";
    audioRef = null;
  }
  setState("idle");
}

export async function speakTTS(
  text: string,
  voice?: string,
  language?: string,
  /** ID of the annotation item requesting playback. */
  annId?: string | null,
) {
  // Stop current playback
  stopTTS();

  speakingId = annId ?? null;
  listeners.forEach((fn) => fn({ state: "idle", speakingId }));

  const config = useTTSStore.getState().config;

  if (config.provider === "mimo") {
    setState("loading");
    try {
      const response = await fetch(MIMO_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": config.mimoApiKey,
        },
        body: JSON.stringify(
          buildMimoBody(config, voice || config.mimoVoice, text),
        ),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        throw new Error(`MiMo API ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const base64Audio = data?.choices?.[0]?.message?.audio?.data;
      if (!base64Audio) throw new Error("MiMo response missing audio data");

      const binaryStr = atob(base64Audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const blob = new Blob([bytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef = null;
        setState("idle");
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef = null;
        setState("error");
      };

      await audio.play();
      setState("playing");
    } catch (err) {
      console.error("[MiMo TTS] failed:", err);
      setState("error");
    }
  } else {
    setState("loading");
    try {
      const resolvedVoice = voice || useTTSStore.getState().getVoice(language);
      const audioData: number[] = await window.siltflow.tts.speak(text, {
        voice: resolvedVoice,
        rate: config.rate,
        volume: config.volume,
        pitch: config.pitch,
        binaryPath: config.binaryPath || undefined,
      });

      if (!audioData || audioData.length === 0) {
        setState("error");
        return;
      }

      const blob = new Blob([new Uint8Array(audioData)], {
        type: "audio/mpeg",
      });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef = null;
        setState("idle");
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef = null;
        setState("error");
      };

      await audio.play();
      setState("playing");
    } catch (err) {
      console.error("[Edge TTS] failed:", err);
      setState("error");
    }
  }
}
