/**
 * Singleton TTS service for mobile (Expo / React Native).
 *
 * Replaces desktop's `lib/tts.ts` which relies on `HTMLAudioElement`
 * and Tauri IPC bridge.  Instead:
 *  - Edge-TTS: POST to sync-server's /api/tts/speak proxy (server spawns
 *    the edge-tts Python CLI, returns MP3) → writes to cache → plays via
 *    `expo-audio` AudioPlayer
 *  - MiMo: calls xiaomimomo API → base64 WAV → plays via expo-audio
 *
 * Share a single AudioPlayer instance and playback state across all
 * callers, same as the desktop singleton model.
 *
 * Usage (same API as desktop):
 *   import { speakTTS, stopTTS, getTTSStatus, onTTSStateChange } from "@/lib/tts"
 */

import { useTTSStore } from "@/stores/tts.store";
import { useSyncStore } from "@/stores/sync.store";
import { Paths, File, EncodingType } from "expo-file-system";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";

// ── Types ───────────────────────────────────────────────────────────────

export type TTSState = "idle" | "loading" | "playing" | "error";

export interface TTSStatus {
  state: TTSState;
  /** ID of the annotation item that started this playback, if any. */
  speakingId: string | null;
}

// ── Module-level state ──────────────────────────────────────────────────

let state: TTSState = "idle";
let speakingId: string | null = null;
let playerRef: AudioPlayer | null = null;
/** Cleanup fn for the current playbackStatusUpdate listener. */
let statusListenerCleanup: (() => void) | null = null;
const listeners = new Set<(s: TTSStatus) => void>();

let cachedStatus: TTSStatus = { state: "idle", speakingId: null };
let audioModeSet = false;

// ── Lazy audio-mode init (called once per process) ──────────────────────

async function ensureAudioMode() {
  if (audioModeSet) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    staysActiveInBackground: false,
    interruptionModeIOS: "duckOthers",
    shouldDuckAndroid: true,
  });
  audioModeSet = true;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function setState(next: TTSState) {
  state = next;
  if (next === "idle" || next === "error") speakingId = null;
  cachedStatus = { state, speakingId };
  listeners.forEach((fn) => fn(cachedStatus));
}

/** Subscribe to state changes. Returns unsubscribe fn. */
export function onTTSStateChange(fn: (s: TTSStatus) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getTTSStatus(): TTSStatus {
  return cachedStatus;
}

// ── Public API ──────────────────────────────────────────────────────────

export function stopTTS() {
  if (playerRef) {
    detachListener();
    playerRef.release();
    playerRef = null;
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
    await speakMiMo(text, voice ?? config.mimoVoice, config);
  } else {
    await speakEdgeTTS(text, voice, language, config);
  }
}

// ── Status listener management ──────────────────────────────────────────

function detachListener() {
  if (statusListenerCleanup) {
    statusListenerCleanup();
    statusListenerCleanup = null;
  }
}

/**
 * Attach a one-shot playback-status listener to the current player.
 * Fires on every status update; cleans up when playback ends or errors.
 */
function attachListener(player: AudioPlayer, fileToDelete?: File) {
  const onStatus = (status: AudioStatus) => {
    if (status.error) {
      console.error("[TTS mobile] playback error:", status.error);
      detachListener();
      player.release();
      playerRef = null;
      fileToDelete?.delete();
      setState("error");
      return;
    }
    if (status.didJustFinish) {
      detachListener();
      player.release();
      playerRef = null;
      fileToDelete?.delete();
      setState("idle");
      return;
    }
  };

  player.addListener("playbackStatusUpdate", onStatus);
  statusListenerCleanup = () =>
    player.removeListener("playbackStatusUpdate", onStatus);
}

// ── Edge-TTS (via sync-server proxy) ──────────────────────────────────

async function speakEdgeTTS(
  text: string,
  voice: string | undefined,
  language: string | undefined,
  config: ReturnType<typeof useTTSStore.getState>["config"],
) {
  setState("loading");

  try {
    const syncConfig = useSyncStore.getState().config;
    if (!syncConfig.syncEnabled || !syncConfig.deviceToken || !syncConfig.serverUrl) {
      throw new Error("Sync server not connected. TTS requires a configured sync server.");
    }

    const resolvedVoice =
      voice || useTTSStore.getState().getVoice(language);

    const response = await fetch(
      `${syncConfig.serverUrl}/api/tts/speak`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${syncConfig.deviceToken}`,
        },
        body: JSON.stringify({
          text,
          voice: resolvedVoice,
          rate: config.rate,
          volume: config.volume,
          pitch: config.pitch,
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(
        (errBody as { error?: string }).error ??
        (errBody as { message?: string }).message ??
        `TTS server error: HTTP ${response.status}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error("TTS server returned empty audio");
    }

    const mp3 = new Uint8Array(arrayBuffer);

    // Write to cache file so expo-audio can read it as a local URI
    const file = new File(Paths.cache, `tts-${Date.now()}.mp3`);
    file.create();
    const base64 = bytesToBase64(mp3);
    file.write(base64, { encoding: EncodingType.Base64 });

    await ensureAudioMode();

    const player = createAudioPlayer(file.uri);
    playerRef = player;

    attachListener(player, file);
    player.play();
    setState("playing");
  } catch (err) {
    console.error("[Edge-TTS mobile] failed:", err);
    setState("error");
  }
}

// ── MiMo ────────────────────────────────────────────────────────────────

async function speakMiMo(
  text: string,
  voice: string,
  config: ReturnType<typeof useTTSStore.getState>["config"],
) {
  setState("loading");

  try {
    const messages: { role: string; content: string }[] = [];
    if (config.mimoStylePrompt?.trim()) {
      messages.push({ role: "user", content: config.mimoStylePrompt.trim() });
    }
    let assistantContent = text;
    if (config.mimoInlineTag?.trim()) {
      assistantContent = `${config.mimoInlineTag.trim()}${text}`;
    }
    messages.push({ role: "assistant", content: assistantContent });

    const response = await fetch(
      "https://api.xiaomimomo.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": config.mimoApiKey,
        },
        body: JSON.stringify({
          model: config.mimoModel,
          messages,
          audio: { format: "wav", voice },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `MiMo API ${response.status}: ${await response.text().catch(() => "Unknown error")}`,
      );
    }

    const data = await response.json();
    const base64Audio = data?.choices?.[0]?.message?.audio?.data;
    if (!base64Audio) throw new Error("MiMo response missing audio data");

    // Decode base64
    const binaryStr = atob(base64Audio);
    const wavBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      wavBytes[i] = binaryStr.charCodeAt(i);
    }

    // Write WAV to cache and play
    const wavFile = new File(Paths.cache, `tts-${Date.now()}.wav`);
    wavFile.create();
    const wavBase64 = bytesToBase64(wavBytes);
    wavFile.write(wavBase64, { encoding: EncodingType.Base64 });

    await ensureAudioMode();

    const player = createAudioPlayer(wavFile.uri);
    playerRef = player;

    attachListener(player, wavFile);
    player.play();
    setState("playing");
  } catch (err) {
    console.error("[MiMo TTS mobile] failed:", err);
    setState("error");
  }
}

// ── Base64 helper ───────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  // RN doesn't have btoa for Uint8Array — do it manually
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
