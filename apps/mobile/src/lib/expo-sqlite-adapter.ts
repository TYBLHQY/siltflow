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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return db.getAllSync(sql, bind(params)) as any;
    },

    get<T = Record<string, unknown>>(
      sql: string,
      ...params: unknown[]
    ): T | undefined {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return db.getFirstSync(sql, bind(params)) as any;
    },

    exec(sql: string): void {
      db.execSync(sql);
    },

    transaction<T>(fn: (executor: SqlExecutor) => T): T {
      let result: T;
      db.withTransactionSync(() => {
        result = fn(this);
      });
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return result!;
    },
  };
}
