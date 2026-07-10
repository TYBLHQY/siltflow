/**
 * Browser-compatible WebSocket shim for isomorphic-ws.
 * The edge-tts-ts library passes options like `{ headers }` to
 * WebSocket constructor as a second argument. Native browser WebSocket
 * interprets this as subprotocol (array of strings) — which fails.
 *
 * This shim discards the options and uses the native WebSocket directly.
 */
export default globalThis.WebSocket
