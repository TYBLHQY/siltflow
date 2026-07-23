/**
 * Shared types for the Hono request context.
 */

import type { getDb as GetDbFn } from "./db";
import type { WsHub } from "./ws";

/** App-scoped singletons injected into every request via c.set("ctx", …). */
export interface AppContext {
  getDb: typeof GetDbFn;
  wsHub: WsHub;
}

/** Hono Variables — declared once, available on all c.var / c.set / c.get. */
export type Variables = {
  config: import("./config").ServerConfig;
  ctx: AppContext;
  deviceId: string;
  isAdmin: boolean;
};
