/**
 * Ambient declarations for optional dependency `ws`.
 * Only used in Node.js / Electron environments where global WebSocket
 * is not available. In React Native / browsers this module is never loaded.
 */
declare module "ws" {
  import { EventEmitter } from "events";
  class WebSocket extends EventEmitter {
    constructor(url: string, protocols?: string | string[]);
    send(data: string | ArrayBuffer | Uint8Array, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: string, listener: (...args: any[]) => void): void;
    removeEventListener(type: string, listener: (...args: any[]) => void): void;
    onopen: ((event: any) => void) | null;
    onmessage: ((event: { data: any }) => void) | null;
    onerror: ((event: any) => void) | null;
    onclose: ((event: any) => void) | null;
  }
  export default WebSocket;
}
