/**
 * TTS hook — supports Edge-TTS (Electron subprocess) and XiaoMi MiMo (direct API).
 */
import { useCallback, useRef, useState } from "react";
import { useTTSStore } from "@/stores/tts.store";

export type TTSState = "idle" | "loading" | "playing" | "error";

const MIMO_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";

/** Build the MiMo request body with style controls. */
function buildMimoBody(
  config: ReturnType<typeof useTTSStore.getState>["config"],
  voice: string,
  text: string,
) {
  const messages: { role: string; content: string }[] = [];

  // Style prompt → user message
  if (config.mimoStylePrompt?.trim()) {
    messages.push({ role: "user", content: config.mimoStylePrompt.trim() });
  }

  // Inline tag prepended to assistant content
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

export function useTTS() {
  const [state, setState] = useState<TTSState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setState("idle");
  }, []);

  const speak = useCallback(
    async (text: string, voice?: string, language?: string) => {
      // Stop current playback
      stop();

      const config = useTTSStore.getState().config;

      if (config.provider === "mimo") {
        // ── MiMo TTS ──
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
          if (!base64Audio) {
            throw new Error("MiMo response missing audio data");
          }

          const binaryStr = atob(base64Audio);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const blob = new Blob([bytes], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onended = () => {
            URL.revokeObjectURL(url);
            audioRef.current = null;
            setState("idle");
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            audioRef.current = null;
            setState("error");
          };

          await audio.play();
          setState("playing");
        } catch (err) {
          console.error("[MiMo TTS] failed:", err);
          setState("error");
        }
      } else {
        // ── Edge-TTS ──
        setState("loading");
        try {
          const resolvedVoice =
            voice || useTTSStore.getState().getVoice(language);
          const audioData: number[] = await window.siltflow.tts.speak(text, {
            voice: resolvedVoice,
            rate: config.rate,
            volume: config.volume,
            pitch: config.pitch,
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
          audioRef.current = audio;

          audio.onended = () => {
            URL.revokeObjectURL(url);
            audioRef.current = null;
            setState("idle");
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            audioRef.current = null;
            setState("error");
          };

          await audio.play();
          setState("playing");
        } catch (err) {
          console.error("[Edge TTS] failed:", err);
          setState("error");
        }
      }
    },
    [stop],
  );

  return { state, speak, stop };
}
