/**
 * Sync WebSocket client — listens for real-time "sync:available"
 * notifications from the sync server and fires callbacks.
 *
 * Uses React Native's built-in WebSocket global (no ws package needed).
 * Auto-reconnects with exponential backoff.
 *
 * Adapted from apps/desktop/electron/sync/ws-client.ts
 */

export interface SyncAvailableEvent {
  type: "sync:available";
  changedBy: string;
  timestamp: string;
  accepted: number;
}

export type WsCallback = (event: SyncAvailableEvent) => void;
export type WsStatusCallback = () => void;
export type WsErrorCallback = (err: Error) => void;

export class SyncWsClient {
  private wsUrl: string;
  private token: string;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay: number;
  private terminated = false;

  // Callback registrations (simple pattern instead of EventEmitter)
  private _onSyncAvailable: WsCallback[] = [];
  private _onConnected: WsStatusCallback[] = [];
  private _onDisconnected: WsStatusCallback[] = [];
  private _onError: WsErrorCallback[] = [];

  constructor(wsUrl: string, token: string) {
    this.wsUrl = wsUrl;
    this.token = token;
    this.reconnectDelay = 1000;
  }

  // ── Callback registration ──────────────────────────────────────────

  onSyncAvailable(cb: WsCallback): void {
    this._onSyncAvailable.push(cb);
  }

  onConnected(cb: WsStatusCallback): void {
    this._onConnected.push(cb);
  }

  onDisconnected(cb: WsStatusCallback): void {
    this._onDisconnected.push(cb);
  }

  onError(cb: WsErrorCallback): void {
    this._onError.push(cb);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  connect(): void {
    if (this.terminated) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const url = `${this.wsUrl}?token=${encodeURIComponent(this.token)}`;

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      this._emitError(
        err instanceof Error ? err : new Error(String(err)),
      );
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 1000; // reset backoff on successful connect
      for (const cb of this._onConnected) cb();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(
          typeof event.data === "string" ? event.data : "",
        ) as SyncAvailableEvent;
        if (msg.type === "sync:available") {
          for (const cb of this._onSyncAvailable) cb(msg);
        }
      } catch {
        // Ignore non-JSON or malformed messages
      }
    };

    this.ws.onclose = () => {
      for (const cb of this._onDisconnected) cb();
      this.scheduleReconnect();
    };

    this.ws.onerror = (event) => {
      // React Native WebSocket error events have a `message` property
      const message =
        typeof (event as unknown as { message?: string }).message === "string"
          ? (event as unknown as { message: string }).message
          : "WebSocket error";
      this._emitError(new Error(message));
      // onclose will fire next, triggering reconnect
    };
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

  // ── Internal ───────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.terminated) return;
    if (this.reconnectTimer) return; // already scheduled

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000); // max 30s
      this.connect();
    }, this.reconnectDelay);
  }

  private _emitError(err: Error): void {
    for (const cb of this._onError) cb(err);
  }
}
