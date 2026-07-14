import type { CommunicateOptions, TTSChunk } from "./types.js";
import { ClockSkewManager } from "./drm.js";
import { buildSpeechConfig, buildSsml, buildSsmlHeaders } from "./ssml.js";
import { splitTextByByteLength } from "./text-splitter.js";
import {
  DEFAULT_VOICE,
  SEC_MS_GEC_VERSION,
  TEXT_CHUNK_MAX_BYTES,
  WSS_HEADERS,
  WSS_URL,
} from "./constants.js";
import {
  generateConnectId,
  generateMuid,
  parseWsMessage,
  sendWsText,
  isNode,
} from "./utils.js";

/**
 * Get a WebSocket constructor.
 *
 * In React Native / browser, uses globalThis.WebSocket (no custom headers).
 * In Node.js / Electron, loads the `ws` package behind a hidden dynamic import
 * (new Function() hides the import() from Metro's static analyzer, preventing
 * it from bundling ws + native .node modules).
 */
let _WS: any;

/** Load the `ws` package — hidden from Metro's static analyzer. */
async function loadNodeWS(): Promise<any> {
  try {
    const wsMod = await new Function(`return import("ws")`)();
    return wsMod?.default?.WebSocket ?? wsMod?.default ?? wsMod?.WebSocket ?? wsMod;
  } catch {
    return null;
  }
}

async function getWS(): Promise<any> {
  if (_WS) return _WS;

  // React Native / browser — global WebSocket exists
  if (typeof globalThis.WebSocket !== "undefined") {
    _WS = globalThis.WebSocket;
    return _WS;
  }

  // Node.js / Electron — try ws package
  const ws = await loadNodeWS();
  if (ws) { _WS = ws; return _WS; }

  throw new Error("@siltflow/edge-tts: WebSocket not available");
}

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
 * Matches the Python edge-tts __parse_metadata format.
 *
 * Expected JSON structure (from "audio.metadata" text frames):
 *   { "Metadata": [{ "Type": "WordBoundary",
 *     "Data": { "Offset": 123, "Duration": 456,
 *       "text": { "Text": "hello" } } }] }
 */
function parseMetadataBody(body: string): {
  type: string;
  offset: number;
  duration: number;
  text: string;
} | null {
  try {
    const parsed = JSON.parse(body);
    const items = parsed.Metadata ?? [parsed];
    for (const item of items) {
      const metaType = item.Type;
      if (metaType === "WordBoundary" || metaType === "SentenceBoundary") {
        const data = item.Data ?? item;
        return {
          type: metaType,
          offset: data.Offset ?? 0,
          duration: data.Duration ?? 0,
          text: data.text?.Text ?? data.Text ?? "",
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
 * Passes custom headers via the `ws` package's options (Node.js/Electron)
 * so the Edge server gets the required Cookie and Origin headers.
 */
function connectWs(
  url: string,
  muid: string,
  timeoutMs = 10_000,
): Promise<WebSocket> {
  return getWS().then((WS: any) => {
    return new Promise<WebSocket>((resolve, reject) => {
      let ws: WebSocket;

      // ws package accepts options (headers, etc.) as third argument
      // globalThis.WebSocket does not support custom headers
      if (isNode()) {
        // ws package — pass custom headers
        ws = new (WS as any)(url, undefined, {
          headers: {
            ...WSS_HEADERS,
            Cookie: `muid=${muid};`,
          },
        });
      } else {
        // globalThis.WebSocket in browser/RN — no custom headers
        ws = new WS(url);
      }

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
  });
}

/**
 * Edge TTS client.  Connects to Microsoft Edge's online TTS service
 * via WebSocket, streams MP3 audio chunks and word/sentence boundary events.
 *
 * Cross-platform: works in Node.js 21+/Electron 43+, React Native, and browsers.
 */
export class Communicate {
  private text: string;
  private voice: string;
  private rate: string;
  private volume: string;
  private pitch: string;
  private wordBoundary: boolean;
  private sentenceBoundary: boolean;
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
      ConnectionId: this.connectId,
      "Sec-MS-GEC": token,
      "Sec-MS-GEC-Version": SEC_MS_GEC_VERSION,
      muid: this.muid,
    });
    return `${WSS_URL}&${params.toString()}`;
  }

  /**
   * Synthesize one text chunk — connect, send config + SSML, receive audio,
   * then disconnect on turn.end.
   */
  private async *_synthesizeChunk(
    text: string,
  ): AsyncGenerator<TTSChunk, void, unknown> {
    const url = this.buildWsUrl();
    const ws = await connectWs(url, this.muid);

    try {
      // 1. Send speech.config (Python-style: booleans as "true"/"false" strings)
      await sendWsText(
        ws,
        buildSpeechConfig(this.wordBoundary, this.sentenceBoundary),
      );

      // 2. Send SSML
      const ssml = buildSsml(
        text,
        this.voice,
        this.rate,
        this.volume,
        this.pitch,
      );
      await sendWsText(ws, buildSsmlHeaders(ssml));

      // 3. Receive loop — matches Python's async for received in websocket
      for await (const event of wsMessages(ws)) {
        const data = (event as any).data;
        if (typeof data === "string") {
          // Text frame — metadata or control signal
          const { headers, body } = parseTextFrame(data);
          const path = headers["path"] ?? "";

          if (path === "turn.end") {
            break;
          }

          if (path === "audio.metadata" && body) {
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
        } else if (data instanceof ArrayBuffer || (typeof Buffer !== "undefined" && data instanceof Buffer)) {
          // Binary frame — audio data (MP3)
          // ws library sends Buffer (with possible byteOffset), browser sends ArrayBuffer
          const raw = data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          // Must use a COPY of the buffer to avoid the full backing store
          const copy = raw.slice(); // returns Uint8Array — .buffer is the minimal copy
          const parsed = parseWsMessage(copy.buffer);
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
