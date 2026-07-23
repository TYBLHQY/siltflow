/**
 * Sync WebSocket client — listens for real-time "sync:available"
 * notifications from the sync server and emits them as events.
 *
 * Runs in the Electron main process. Auto-reconnects with exponential
 * backoff. Responds to server pings to keep the connection alive.
 */

import { EventEmitter } from "node:events";
import { WebSocket } from "ws";

export interface SyncWsClient {
  on(event: "sync:available", listener: (payload: SyncAvailableEvent) => void): this;
  on(event: "connected", listener: () => void): this;
  on(event: "disconnected", listener: () => void): this;
  on(event: "error", listener: (err: Error) => void): this;
}

export interface SyncAvailableEvent {
  type: "sync:available";
  changedBy: string;
  timestamp: string;
  accepted: number;
  conflictCount: number;
}

export class SyncWsClient extends EventEmitter {
  private wsUrl: string;
  private token: string;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay: number;
  private terminated = false;

  constructor(wsUrl: string, token: string) {
    super();
    this.wsUrl = wsUrl;
    this.token = token;
    this.reconnectDelay = 1000;
  }

  connect(): void {
    if (this.terminated) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = `${this.wsUrl}?token=${encodeURIComponent(this.token)}`;

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.reconnectDelay = 1000; // reset backoff on successful connect
      this.emit("connected");
    });

    this.ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as SyncAvailableEvent;
        if (msg.type === "sync:available") {
          this.emit("sync:available", msg);
        }
      } catch {
        // Ignore non-JSON or malformed messages
      }
    });

    this.ws.on("close", () => {
      this.emit("disconnected");
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
      // close will fire next, triggering reconnect
    });

    // Respond to server pings
    this.ws.on("ping", () => {
      this.ws?.pong();
    });
  }

  disconnect(): void {
    this.terminated = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect(): void {
    if (this.terminated) return;
    if (this.reconnectTimer) return; // already scheduled

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000); // max 30s
      this.connect();
    }, this.reconnectDelay);
  }
}
