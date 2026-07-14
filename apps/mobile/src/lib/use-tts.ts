import { useCallback, useRef, useState } from "react";
import { useTTSStore } from "../stores/tts.store";

export type TTSStatus = "idle" | "loading" | "playing" | "error";

/**
 * Hook wrapping @siltflow/edge-tts for mobile use.
 *
 * Speaks text by streaming from Edge TTS WebSocket, then playing
 * the audio via an HTMLAudioElement from the concatenated MP3 blob.
 */
export function useTTS() {
  const config = useTTSStore((s) => s.config);
  const getVoice = useTTSStore((s) => s.getVoice);
  const [status, setStatus] = useState<TTSStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setStatus("idle");
  }, []);

  const speak = useCallback(
    async (text: string, language?: string) => {
      if (!text) return;

      // Stop any current playback
      stop();

      setStatus("loading");
      try {
        const voice = getVoice(language);
        const { Communicate } = await import("@siltflow/edge-tts");

        const tts = new Communicate(text, {
          voice,
          rate: config.rate,
          volume: config.volume,
          pitch: config.pitch,
        });

        const audioChunks: Uint8Array[] = [];
        for await (const chunk of tts.stream()) {
          if (chunk.type === "audio") {
            audioChunks.push(chunk.data);
          }
        }

        if (audioChunks.length === 0) {
          setStatus("error");
          return;
        }

        // Concatenate chunks into a single blob
        const totalLength = audioChunks.reduce((s, c) => s + c.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of audioChunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }

        // Create a blob URL and play it
        const blob = new Blob([merged], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          setStatus("idle");
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setStatus("error");
        };

        await audio.play();
        setStatus("playing");
      } catch (err) {
        console.error("TTS error:", err);
        setStatus("error");
      }
    },
    [config, getVoice, stop],
  );

  return { speak, stop, status };
}
