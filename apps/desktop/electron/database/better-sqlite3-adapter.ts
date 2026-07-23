/**
 * SqlExecutor adapter for better-sqlite3 (Electron / Node.js desktop).
 *
 * Wraps a native better-sqlite3 Database instance into the platform-agnostic
 * SqlExecutor interface used by shared migration code.
 *
 * Lives in the desktop app (not the shared package) because it imports
 * the platform-specific better-sqlite3 module.
 */

import type Database from "better-sqlite3";
import type { SqlExecutor, SqlRunResult } from "@siltflow/shared-db/db";

export function createBetterSqlite3Executor(
  db: Database.Database,
): SqlExecutor {
  return {
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
      // better-sqlite3 transactions are synchronous — calling fn directly
      // inside db.transaction() handles BEGIN/COMMIT/ROLLBACK
      const txFn = db.transaction(() => fn(this));
      return txFn();
    },
  };
}
