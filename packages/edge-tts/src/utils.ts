import type { ParsedWsMessage } from "./types.js";

/**
 * Generate a UUID-like hex string without dashes for the ConnectionId.
 * Uses crypto.getRandomValues — polyfilled in React Native via
 * react-native-get-random-values.
 */
export function generateConnectId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a 32-character uppercase hex string for the muid cookie.
 */
export function generateMuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Concatenate multiple Uint8Arrays into one.
 */
export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Detect if running in Node.js / Electron main process.
 */
export function isNode(): boolean {
  return typeof process !== "undefined" && process.versions?.node != null;
}

/**
 * Format a Date like the Python edge-tts date_to_string():
 * "Tue Jul 15 2025 12:00:00 GMT+0000 (Coordinated Universal Time)"
 */
export function dateToString(date?: Date): string {
  if (!date) date = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const d = days[date.getUTCDay()];
  const m = months[date.getUTCMonth()];
  const dom = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d} ${m} ${dom} ${y} ${h}:${min}:${s} GMT+0000 (Coordinated Universal Time)`;
}

/**
 * Parse a WebSocket binary frame from Edge TTS.
 *
 * Format:
 *   [2 bytes: header length (uint16 big-endian)]
 *   [N bytes: HTTP-style headers]
 *   [remaining bytes: MP3 audio data]
 */
export function parseWsMessage(data: ArrayBuffer): ParsedWsMessage {
  const view = new DataView(data);
  const headerLength = view.getUint16(0, false); // big-endian
  const audioOffset = 2 + headerLength;

  // Guard: header length might be corrupt or data truncated
  if (headerLength < 0 || audioOffset > data.byteLength) {
    return { headers: {}, data: new Uint8Array(0) };
  }

  const headerBytes = new Uint8Array(data, 2, headerLength);
  const headerStr = new TextDecoder().decode(headerBytes);

  const headers: Record<string, string> = {};
  for (const line of headerStr.split("\r\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      headers[line.slice(0, colonIdx).trim().toLowerCase()] = line
        .slice(colonIdx + 1)
        .trim();
    }
  }

  const audioData = new Uint8Array(data, audioOffset);
  return { headers, data: audioData };
}

/**
 * Read the next message from a WebSocket as an ArrayBuffer.
 */
export function readWsMessage(ws: WebSocket): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      cleanup();
      resolve(event.data as ArrayBuffer);
    };
    const onError = () => {
      cleanup();
      reject(new Error("WebSocket error while reading message"));
    };
    const onClose = () => {
      cleanup();
      reject(new Error("WebSocket closed while reading message"));
    };
    const cleanup = () => {
      ws.removeEventListener("message", onMessage);
      ws.removeEventListener("error", onError);
      ws.removeEventListener("close", onClose);
    };
    ws.addEventListener("message", onMessage);
    ws.addEventListener("error", onError);
    ws.addEventListener("close", onClose);
  });
}

/**
 * Send a text frame on a WebSocket. Returns a Promise that resolves when sent.
 */
export function sendWsText(ws: WebSocket, text: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      ws.send(text);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}
