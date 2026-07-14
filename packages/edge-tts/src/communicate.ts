import type { CommunicateOptions, TTSChunk } from "./types.js";
import { ClockSkewManager } from "./drm.js";
import { buildSpeechConfig, buildSsml, buildSsmlHeaders } from "./ssml.js";
import { splitTextByByteLength } from "./text-splitter.js";
import {
  DEFAULT_VOICE,
  SEC_MS_GEC_VERSION,
  TEXT_CHUNK_MAX_BYTES,
  TRUSTED_CLIENT_TOKEN,
  WSS_URL,
} from "./constants.js";
import { generateConnectId, generateMuid, parseWsMessage, sendWsText } from "./utils.js";

/**
 * Parse a text frame from Edge TTS.  Format:
 *   Key:Value\r\n
 *   Key:Value\r\n
 *   \r\n
 *   body
 */
function parseTextFrame(
  data: string,
): { headers: Record<string, string>; body: string } {
  const idx = data.indexOf("\r\n\r\n");
  const headerStr = idx >= 0 ? data.slice(0, idx) : data;
  const body = idx >= 0 ? data.slice(idx + 4) : "";

  const headers: Record<string, string> = {};
  for (const line of headerStr.split("\r\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      headers[line.slice(0, colon).trim().toLowerCase()] = line
        .slice(colon + 1)
        .trim();
    }
  }
  return { headers, body };
}

/**
 * Parse the JSON metadata body for WordBoundary/SentenceBoundary info.
 */
function parseMetadataBody(body: string): {
  type: string;
  offset: number;
  duration: number;
  text: string;
} | null {
  try {
    const parsed = JSON.parse(body);
    // Metadata comes as { Metadata: [...] } or as a single object
    const items = parsed.Metadata ?? [parsed];
    for (const item of items) {
      if (
        item.Type === "WordBoundary" ||
        item.Type === "SentenceBoundary"
      ) {
        return {
          type: item.Type,
          offset: item.Offset,
          duration: item.Duration,
          text: item.Text?.Text ?? "",
        };
      }
    }
  } catch {
    // Not JSON or unexpected format — ignore
  }
  return null;
}

/**
 * Yield all messages from a WebSocket as an async generator.
 */
async function* wsMessages(
  ws: WebSocket,
): AsyncGenerator<MessageEvent, void, unknown> {
  const buffer: MessageEvent[] = [];
  let pendingResolve: ((event: MessageEvent | null) => void) | null = null;
  let closed = false;
  let wsError: Error | null = null;

  const onMessage = (event: MessageEvent) => {
    if (pendingResolve) {
      const r = pendingResolve;
      pendingResolve = null;
      r(event);
    } else {
      buffer.push(event);
    }
  };

  const onError = () => {
    wsError = new Error(`WebSocket error`);
  };

  const onClose = () => {
    closed = true;
    if (pendingResolve) {
      pendingResolve(null);
      pendingResolve = null;
    }
  };

  ws.addEventListener("message", onMessage);
  ws.addEventListener("error", onError);
  ws.addEventListener("close", onClose);

  try {
    while (!closed || buffer.length > 0) {
      if (buffer.length > 0) {
        yield buffer.shift()!;
      } else if (wsError) {
        throw wsError;
      } else {
        const event = await new Promise<MessageEvent | null>((r) => {
          pendingResolve = r;
        });
        if (!event) break;
        yield event;
      }
    }
  } finally {
    ws.removeEventListener("message", onMessage);
    ws.removeEventListener("error", onError);
    ws.removeEventListener("close", onClose);
  }
}

/**
 * Wait for the WebSocket connection to open.
 * Uses the `wsImpl` option if provided, otherwise globalThis.WebSocket.
 */
function connectWs(
  url: string,
  wsImpl?: { new(url: string): WebSocket },
  timeoutMs = 10_000,
): Promise<WebSocket> {
  const WS = wsImpl ?? globalThis.WebSocket;
  if (!WS) {
    return Promise.reject(
      new Error(
        "@siltflow/edge-tts: WebSocket not available. " +
          "In Node.js < 21 / Electron, pass the `ws` package as `wsImpl` option.",
      ),
    );
  }
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WS(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket connection timed out"));
    }, timeoutMs);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("WebSocket connection failed"));
    });
  });
}

/**
 * Edge TTS client.  Connects to Microsoft Edge's online TTS service
 * via WebSocket, streams audio chunks and word/sentence boundary events.
 *
 * Cross-platform: works in Node.js 18+/Electron and React Native.
 *
 * @example
 * ```ts
 * // React Native / browsers (global WebSocket available)
 * const tts = new Communicate("Hello world");
 *
 * // Electron / Node < 21 (need `ws` package)
 * import WebSocket from "ws";
 * const tts = new Communicate("Hello world", { wsImpl: WebSocket });
 *
 * for await (const chunk of tts.stream()) {
 *   if (chunk.type === "audio") playAudio(chunk.data);
 * }
 * ```
 */
export class Communicate {
  private text: string;
  private voice: string;
  private rate: string;
  private volume: string;
  private pitch: string;
  private wordBoundary: boolean;
  private sentenceBoundary: boolean;
  private wsImpl: { new(url: string): WebSocket } | undefined;
  private muid: string;
  private connectId: string;
  private clockSkew: ClockSkewManager;

  constructor(text: string, options: CommunicateOptions = {}) {
    this.text = text;
    this.voice = options.voice ?? DEFAULT_VOICE;
    this.rate = options.rate ?? "+0%";
    this.volume = options.volume ?? "+0%";
    this.pitch = options.pitch ?? "+0Hz";
    this.wordBoundary = options.wordBoundary ?? true;
    this.sentenceBoundary = options.sentenceBoundary ?? false;
    this.wsImpl = options.wsImpl;
    this.muid = generateMuid();
    this.connectId = generateConnectId();
    this.clockSkew = new ClockSkewManager();
  }

  /**
   * Build the WebSocket URL with authentication parameters.
   */
  private buildWsUrl(): string {
    const { token } = this.clockSkew.getAdjustedToken();
    const params = new URLSearchParams({
      TrustedClientToken: TRUSTED_CLIENT_TOKEN,
      ConnectionId: this.connectId,
      "Sec-MS-GEC": token,
      "Sec-MS-GEC-Version": SEC_MS_GEC_VERSION,
      muid: this.muid,
    });
    return `${WSS_URL}?${params.toString()}`;
  }

  /**
   * Synthesize one text chunk — connect, send config + SSML, receive audio,
   * then disconnect on turn.end.
   */
  private async *_synthesizeChunk(
    text: string,
  ): AsyncGenerator<TTSChunk, void, unknown> {
    const url = this.buildWsUrl();
    const ws = await connectWs(url, this.wsImpl);

    try {
      // 1. Send speech.config
      await sendWsText(
        ws,
        buildSpeechConfig(this.wordBoundary, this.sentenceBoundary),
      );

      // 2. Send SSML
      const ssml = buildSsml(text, this.voice, this.rate, this.volume, this.pitch);
      await sendWsText(ws, buildSsmlHeaders(ssml));

      // 3. Receive loop
      for await (const event of wsMessages(ws)) {
        if (typeof event.data === "string") {
          // Text frame — metadata or control signal
          const { headers, body } = parseTextFrame(event.data);
          const path = headers["path"] ?? "";

          if (path === "turn.end") {
            break;
          }

          if (path === "response.metadata" && body) {
            const meta = parseMetadataBody(body);
            if (meta) {
              yield {
                type: meta.type as "WordBoundary" | "SentenceBoundary",
                offset: meta.offset,
                duration: meta.duration,
                text: meta.text,
              } as TTSChunk;
            }
          }
          // path === "turn.start" / "response" — ignore
        } else if (event.data instanceof ArrayBuffer) {
          // Binary frame — audio data (MP3)
          const parsed = parseWsMessage(event.data);
          yield { type: "audio", data: parsed.data } as TTSChunk;
        }
      }
    } finally {
      ws.close();
    }
  }

  /**
   * Stream TTS audio chunks and boundary events.
   *
   * Splits long text into chunks (max 4096 bytes each), connects a new
   * WebSocket per chunk, and yields audio + WordBoundary/SentenceBoundary
   * events.
   *
   * On error, retries once with a fresh ConnectionId.
   */
  async *stream(): AsyncGenerator<TTSChunk, void, unknown> {
    const textChunks = splitTextByByteLength(this.text, TEXT_CHUNK_MAX_BYTES);

    for (const chunk of textChunks) {
      let lastError: Error | null = null;

      // Attempt with retry on failure (could be clock skew)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          yield* this._synthesizeChunk(chunk);
          lastError = null;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt === 0) {
            this.connectId = generateConnectId();
            continue;
          }
        }
      }

      if (lastError) {
        throw lastError;
      }
    }
  }
}
