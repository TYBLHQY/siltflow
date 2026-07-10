/**
 * TTS hook using edge-tts-ts.
 * Fetches audio from Microsoft Edge TTS and plays it.
 */
import { useCallback, useRef, useState } from "react"
import { Communicate } from "edge-tts-ts"

export type TTSState = "idle" | "loading" | "playing" | "error"

const DEFAULT_VOICE = "en-US-EmmaMultilingualNeural"

export function useTTS() {
  const [state, setState] = useState<TTSState>("idle")
  const abortRef = useRef<AbortController | null>(null)

  const speak = useCallback(
    async (text: string, voice = DEFAULT_VOICE) => {
      // Stop any current playback
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const signal = abortRef.current.signal

      setState("loading")

      try {
        const audioChunks: Uint8Array[] = []
        const comm = new Communicate(text, {
          voice,
          rate: "+0%",
          volume: "+0%",
          pitch: "+0Hz",
        })

        for await (const chunk of comm.stream()) {
          if (signal.aborted) {
            setState("idle")
            return
          }
          if (chunk.type === "audio") {
            audioChunks.push(chunk.data)
          }
        }

        // Concatenate audio chunks
        const totalLen = audioChunks.reduce((sum, c) => sum + c.length, 0)
        const combined = new Uint8Array(totalLen)
        let offset = 0
        for (const c of audioChunks) {
          combined.set(c, offset)
          offset += c.length
        }

        // Create blob and play
        const blob = new Blob([combined], { type: "audio/mpeg" })
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => {
          URL.revokeObjectURL(url)
          setState("idle")
        }
        audio.onerror = () => {
          URL.revokeObjectURL(url)
          setState("error")
        }
        signal.addEventListener("abort", () => {
          audio.pause()
          audio.src = ""
          URL.revokeObjectURL(url)
        })
        await audio.play()
        setState("playing")
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          setState("idle")
          return
        }
        console.error("[TTS] failed:", err)
        setState("error")
      }
    },
    [],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState("idle")
  }, [])

  return { state, speak, stop }
}
