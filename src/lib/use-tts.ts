/**
 * TTS hook — delegates to main process which shells out to `edge-tts` (Python).
 */
import { useCallback, useRef, useState } from "react"

export type TTSState = "idle" | "loading" | "playing" | "error"

export function useTTS() {
  const [state, setState] = useState<TTSState>("idle")
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const speak = useCallback(async (text: string, voice = "en-US-EmmaMultilingualNeural") => {
    // Stop current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
      audioRef.current = null
    }

    setState("loading")

    try {
      const audioData: number[] = await window.siltflow.tts.speak(text, {
        voice,
        rate: "+0%",
        volume: "+0%",
        pitch: "+0Hz",
      })

      if (!audioData || audioData.length === 0) {
        setState("error")
        return
      }

      const blob = new Blob([new Uint8Array(audioData)], { type: "audio/mpeg" })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        URL.revokeObjectURL(url)
        audioRef.current = null
        setState("idle")
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        audioRef.current = null
        setState("error")
      }

      await audio.play()
      setState("playing")
    } catch (err) {
      console.error("[TTS] failed:", err)
      setState("error")
    }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
      audioRef.current = null
    }
    setState("idle")
  }, [])

  return { state, speak, stop }
}
