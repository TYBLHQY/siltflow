/**
 * Shim module for loading the `ws` package in Node.js / Electron.
 *
 * This file exists as a separate module so that the bundler (Vite) treats
 * the dynamic import as a separate chunk that gets externalized when
 * `ws` is in the rollupOptions.external list.
 *
 * In React Native / browsers this file is never loaded — the code path
 * uses globalThis.WebSocket instead.
 *
 * @private
 */
import WebSocket from "ws";
export default WebSocket;
