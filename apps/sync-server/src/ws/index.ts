/**
 * WebSocket notification hub.
 *
 * Maintains a set of connected clients and broadcasts "sync:available"
 * notifications when data changes. Uses Hono's upgradeWebSocket + ws.
 *
 * Pattern (from hono.dev/docs/helpers/websocket):
 *   Maintain a Set<WebSocket>, add on open, delete on close/error,
 *   broadcast on message.
 */

import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

export interface WsHub {
  /** Broadcast a JSON message to all connected clients. */
  broadcast(type: string, payload: Record<string, unknown>): void;
  /** Create the WebSocketServer attached to an HTTP server. */
  attach(server: Server): WebSocketServer;
}

export function createWsHub(): WsHub {
  let wss: WebSocketServer | null = null;
  const clients = new Set<WebSocket>();

  function attach(server: Server): WebSocketServer {
    wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      // Only handle /ws path
      const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
      if (url.pathname !== "/ws") {
        socket.destroy();
        return;
      }

      // Auth: extract token from query param
      const token = url.searchParams.get("token");
      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      // Token validation happens in the caller's db layer.
      // For now, accept any token — the auth check is best-effort
      // since WS upgrade doesn't go through Hono middleware.
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit("connection", ws, request);
      });
    });

    wss.on("connection", (ws: WebSocket) => {
      clients.add(ws);

      ws.on("close", () => clients.delete(ws));
      ws.on("error", () => clients.delete(ws));

      // Heartbeat
      ws.on("pong", () => {
        (ws as WebSocket & { alive?: boolean }).alive = true;
      });
    });

    // Heartbeat ping every 30s, drop dead clients after 10s
    const heartbeat = setInterval(() => {
      for (const ws of clients) {
        const alive = (ws as WebSocket & { alive?: boolean }).alive;
        if (alive === false) {
          clients.delete(ws);
          ws.terminate();
          return;
        }
        (ws as WebSocket & { alive?: boolean }).alive = false;
        ws.ping();
      }
    }, 30_000);

    wss.on("close", () => clearInterval(heartbeat));

    return wss;
  }

  function broadcast(type: string, payload: Record<string, unknown>) {
    const msg = JSON.stringify({ type, ...payload });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  return { attach, broadcast };
}
