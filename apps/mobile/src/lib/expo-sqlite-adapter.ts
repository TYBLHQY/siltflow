/**
 * SqlExecutor adapter for expo-sqlite (React Native / Expo mobile).
 *
 * Wraps an expo-sqlite SQLiteDatabase (opened via openDatabaseSync) into
 * the platform-agnostic SqlExecutor interface.
 *
 * Uses the synchronous API variants (*Sync) which are safe in React Native
 * thanks to JSI synchronous bridging to the native SQLite thread.
 *
 * Lives in the mobile app (not the shared package) because it imports
 * the platform-specific expo-sqlite module.
 */

import type { SQLiteDatabase, SQLiteBindValue } from "expo-sqlite";
import type { SqlExecutor, SqlRunResult } from "@siltflow/shared-db/db";

function bind(params: unknown[]): SQLiteBindValue[] {
  return params as SQLiteBindValue[];
}

export function createExpoSqliteExecutor(
  db: SQLiteDatabase,
): SqlExecutor {
  return {
    run(sql: string, ...params: unknown[]): SqlRunResult {
      return db.runSync(sql, bind(params));
    },

    all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
      return db.getAllSync(sql, bind(params)) as T[];
    },

    get<T = Record<string, unknown>>(
      sql: string,
      ...params: unknown[]
    ): T | undefined {
      return db.getFirstSync(sql, bind(params)) as T | undefined;
    },

    exec(sql: string): void {
      db.execSync(sql);
    },

    transaction<T>(fn: (executor: SqlExecutor) => T): T {
      let result!: T;
      db.withTransactionSync(() => {
        result = fn(this);
      });
      return result;
    },
  };
}
