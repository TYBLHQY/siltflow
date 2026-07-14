/**
 * Mobile TTS hook — uses @siltflow/edge-tts to fetch audio from
 * Microsoft Edge's online TTS service, then plays via expo-av.
 */

import { useCallback, useRef, useState } from "react";
import { Audio } from "expo-av";
import { Communicate } from "@siltflow/edge-tts";
import * as FileSystem from "expo-file-system";

export type TTSState = "idle" | "loading" | "playing" | "error";

export function useTTS() {
  const [state, setState] = useState<TTSState>("idle");
  const soundRef = useRef<Audio.Sound | null>(null);

  const speak = useCallback(
    async (text: string, voice?: string) => {
      // Stop current playback
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      setState("loading");

      try {
        const tts = new Communicate(text, { voice });
        const audioChunks: Uint8Array[] = [];

        // Stream all audio chunks
        for await (const chunk of tts.stream()) {
          if (chunk.type === "audio") {
            audioChunks.push(chunk.data);
          }
        }

        // Concatenate into single buffer
        const totalLength = audioChunks.reduce(
          (sum, c) => sum + c.length,
          0,
        );
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of audioChunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }

        // Write to a temp file (expo-av cannot play from blob/Uint8Array directly)
        const fileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
        const base64 = btoa(
          Array.from(result, (b) => String.fromCharCode(b)).join(""),
        );
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Play the audio
        const { sound } = await Audio.Sound.createAsync(
          { uri: fileUri },
          { shouldPlay: true },
        );
        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            soundRef.current = null;
            setState("idle");
            // Clean up temp file
            FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(
              () => {},
            );
          }
        });

        setState("playing");
      } catch (err) {
        console.warn("[edge-tts] failed:", err);
        setState("error");
      }
    },
    [],
  );

  const stop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setState("idle");
  }, []);

  return { state, speak, stop };
}
