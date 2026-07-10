/**
 * Browser-compatible WebSocket shim for isomorphic-ws.
 *
 * edge-tts-ts passes `{ headers }` as the second argument to WebSocket.
 * Browser native WebSocket interprets the second arg as subprotocols
 * (string or string[]), not as an options bag — `[object Object]` is
 * never a valid subprotocol.
 *
 * This shim wraps the native WebSocket to discard the options argument
 * and set headers via the `headers` property if supported, or simply
 * ignores them.
 */
class BrowserWebSocket extends globalThis.WebSocket {
  constructor(url: string, _opts?: { headers?: Record<string, string> }) {
    // Browser WebSocket only accepts string|string[] as 2nd arg (subprotocols).
    // Drop the options entirely — headers are not needed for the connection.
    super(url)
  }
}

export default BrowserWebSocket
