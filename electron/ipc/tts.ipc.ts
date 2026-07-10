import { ipcMain } from "electron"
import { spawn } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { readFile, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export function registerTTSHandlers() {
  ipcMain.handle("tts:speak", async (_event, text: string, options: {
    voice?: string
    rate?: string
    volume?: string
    pitch?: string
  }) => {
    const voice = options.voice || "en-US-EmmaMultilingualNeural"
    const rate = options.rate || "+0%"
    const volume = options.volume || "+0%"
    const pitch = options.pitch || "+0Hz"

    const tmpDir = mkdtempSync(join(tmpdir(), "siltflow-tts-"))
    const outPath = join(tmpDir, "tts.mp3")

    return new Promise<number[]>((resolve, reject) => {
      const proc = spawn("edge-tts", [
        "--text", text,
        "--voice", voice,
        "--rate", rate,
        "--volume", volume,
        "--pitch", pitch,
        "--write-media", outPath,
      ], {
        stdio: ["ignore", "pipe", "pipe"],
      })

      let stderr = ""
      proc.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      proc.on("error", (err) => {
        reject(new Error(`edge-tts failed to start: ${err.message}`))
      })

      proc.on("exit", async (code) => {
        if (code !== 0) {
          reject(new Error(`edge-tts exited with code ${code}: ${stderr}`))
          return
        }

        try {
          const buf = await readFile(outPath)
          const audioData = Array.from(new Uint8Array(buf))

          // Cleanup
          unlink(outPath).catch(() => {})
          unlink(tmpDir).catch(() => {})

          resolve(audioData)
        } catch (err) {
          reject(new Error(`edge-tts: failed to read output: ${err}`))
        }
      })
    })
  })
}
