/**
 * TTS hook — delegates to the main process for Edge TTS audio streaming.
 * Main process uses Node.js WebSocket (ws library) which can set proper headers.
 */
import { useCallback, useEffect, useRef, useState } from "react"

export type TTSState = "idle" | "loading" | "playing" | "error"

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()

export function useTTS() {
  const [state, setState] = useState<TTSState>("idle")
  const audioQueueRef = useRef<Uint8Array[]>([])
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)

  const speak = useCallback(async (text: string, voice = "en-US-EmmaMultilingualNeural") => {
    setState("loading")
    audioQueueRef.current = []

    // Listen for audio chunks from main process
    const handler = (_event: any, chunkData: number[]) => {
      audioQueueRef.current.push(new Uint8Array(chunkData))
    }
    window.ipcRenderer.on("tts:audio", handler)

    try {
      await window.ipcRenderer.invoke("tts:speak", text, {
        voice,
        rate: "+0%",
        volume: "+0%",
        pitch: "+0Hz",
      })

      // All audio received — decode and play
      const totalLen = audioQueueRef.current.reduce((sum, c) => sum + c.length, 0)
      const combined = new Uint8Array(totalLen)
      let offset = 0
      for (const c of audioQueueRef.current) {
        combined.set(c, offset)
        offset += c.length
      }

      if (combined.length === 0) {
        setState("error")
        return
      }

      const audioBlob = new Blob([combined], { type: "audio/mpeg" })
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        setState("idle")
      }
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        setState("error")
      }
      await audio.play()
      setState("playing")
    } catch (err) {
      console.error("[TTS] failed:", err)
      setState("error")
    } finally {
      window.ipcRenderer.removeListener("tts:audio", handler)
    }
  }, [])

  const stop = useCallback(() => {
    setState("idle")
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.ipcRenderer.removeAllListeners("tts:audio")
    }
  }, [])

  return { state, speak, stop }
}
