/**
 * SqlExecutor adapter for better-sqlite3 (Node.js / Electron).
 *
 * Wraps a native better-sqlite3 Database instance into the platform-agnostic
 * SqlExecutor interface used by shared migration and sync code.
 *
 * Used by:
 * - apps/desktop (Electron main process)
 * - apps/sync-server (Hono + better-sqlite3)
 */

import type Database from "better-sqlite3";
import type { SqlExecutor, SqlRunResult } from "../db";

export function createBetterSqlite3Executor(
  db: Database.Database,
): SqlExecutor {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const self: SqlExecutor = {} as SqlExecutor;

  const executor: SqlExecutor = {
    run(sql: string, ...params: unknown[]): SqlRunResult {
      const result = db.prepare(sql).run(...params);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowid };
    },

    all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return db.prepare(sql).all(...params) as any;
    },

    get<T = Record<string, unknown>>(
      sql: string,
      ...params: unknown[]
    ): T | undefined {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return db.prepare(sql).get(...params) as any;
    },

    exec(sql: string): void {
      db.exec(sql);
    },

    transaction<T>(fn: (executor: SqlExecutor) => T): T {
      const txFn = db.transaction(() => fn(self));
      return txFn();
    },
  };

  // Populate self reference for use inside transaction()
  Object.assign(self, executor);
  return executor;
}
