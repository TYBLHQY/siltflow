import { ipcMain, BrowserWindow } from "electron"
import WebSocket from "ws"

export function registerTTSHandlers() {
  ipcMain.handle("tts:speak", async (_event, text: string, options: {
    voice?: string
    rate?: string
    volume?: string
    pitch?: string
    boundary?: "WordBoundary" | "SentenceBoundary"
  }) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) throw new Error("No window")
    return new Promise<void>((resolve, reject) => {
      // We run the stream in the main process and send audio chunks back
      // Adapted from edge-tts-ts Communicate._stream
      runEdgeTTS(text, options, win)
        .then(() => resolve())
        .catch((err) => reject(err))
    })
  })
}

interface TTSChunk {
  type: "audio" | "WordBoundary" | "SentenceBoundary"
  data?: number[] // audio as byte array
  offset?: number
  duration?: number
  text?: string
}

async function runEdgeTTS(
  text: string,
  options: {
    voice?: string
    rate?: string
    volume?: string
    pitch?: string
    boundary?: "WordBoundary" | "SentenceBoundary"
  },
  win: BrowserWindow,
): Promise<void> {
  const { default: WebSocket } = await import("ws")
  // We need to import the edge-tts-ts modules. They use isomorphic-ws which in Node works fine.
  // Communicate class is from edge-tts-ts.
  // Let's construct and call it from here.
  // But we can't import it easily due to the import system. Better approach:
  // Reproduce the logic here using the same constants.
  const crypto = await import("node:crypto")
  const BASE_URL = "speech.platform.bing.com/consumer/speech/synthesize/readaloud"
  const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
  const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`
  const CHROMIUM_FULL_VERSION = "143.0.3650.75"
  const SEC_MS_GEC_VERSION = "1-143.0.3650.75"
  const TICKS_PER_SECOND = 10000000
  const MP3_BITRATE_BPS = 48000

  const voice = options.voice || "en-US-EmmaMultilingualNeural"
  const rate = options.rate || "+0%"
  const volume = options.volume || "+0%"
  const pitch = options.pitch || "+0Hz"

  function connectId(): string {
    return crypto.randomBytes(16).toString("hex").toUpperCase()
  }
  function dateToString(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
  }
  function escapeXml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
  }

  // Generate Sec-MS-GEC using Node crypto
  async function generateSecMsGec(): Promise<string> {
    const nonce = crypto.randomBytes(16).toString("hex").toUpperCase()
    const timestamp = Math.floor(Date.now() / 1000)
    const msg = `${timestamp}\r\n${WSS_URL}\r\n${nonce}`
    const hash = crypto.createHash("sha256").update(msg, "utf-8").digest("hex").toUpperCase()
    return hash
  }

  const requestId = connectId()
  const secMsGec = await generateSecMsGec()
  const url = `${WSS_URL}&ConnectionId=${requestId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`

  const ws = new WebSocket(url, {
    headers: {
      "Pragma": "no-cache",
      "Cache-Control": "no-cache",
      "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION} Safari/537.36`,
      "Sec-MS-GEC": secMsGec,
      "Sec-MS-GEC-Version": SEC_MS_GEC_VERSION,
    },
  })

  ws.binaryType = "arraybuffer"

  await new Promise<void>((resolveOpen, rejectOpen) => {
    ws.onopen = () => resolveOpen()
    ws.onerror = (err) => rejectOpen(err)
  })

  function sendCommand() {
    ws.send(
      `X-Timestamp:${dateToString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
      JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: true },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3",
            },
          },
        },
      })
    )

    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${escapeXml(text)}</prosody></voice></speak>`
    ws.send(
      `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateToString()}Z\r\nPath:ssml\r\n\r\n${ssml}`
    )
  }

  sendCommand()

  let cumulativeAudioBytes = 0
  let offsetCompensation = 0

  for await (const rawData of ws as unknown as AsyncIterable<Buffer>) {
    const data = new Uint8Array(rawData as any as ArrayBuffer)
    if (data.length < 2) continue

    const headerLength = (data[0] << 8) | data[1]
    if (headerLength + 2 > data.length) continue

    const headerStr = new TextDecoder().decode(data.slice(2, 2 + headerLength))
    const audioData = data.slice(2 + headerLength)

    if (audioData.length > 0) {
      const chunkData = Array.from(audioData)
      cumulativeAudioBytes += chunkData.length
      win.webContents.send("tts:audio", chunkData)

      // Calculate offset compensation
      offsetCompensation = Math.floor(cumulativeAudioBytes * 8 * TICKS_PER_SECOND / MP3_BITRATE_BPS)
    }

    // Parse header for metadata
    if (headerStr.includes("Path:turn.end")) {
      break
    }
  }

  ws.close()
}
