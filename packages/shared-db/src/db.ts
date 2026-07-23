/**
 * Platform-agnostic SQL executor interface.
 *
 * Both better-sqlite3 (desktop) and expo-sqlite (mobile) implement
 * this contract so higher-level code can run raw SQL without knowing
 * which backend is underneath.
 *
 * NOTE: All methods are synchronous — expo-sqlite v14+ provides full
 * Sync API variants that work safely in React Native via JSI bridging.
 */

export interface SqlRunResult {
  changes: number;
  lastInsertRowId: number | bigint;
}

export interface SqlExecutor {
  /** Execute a write statement (INSERT / UPDATE / DELETE). */
  run(sql: string, ...params: unknown[]): SqlRunResult;

  /** Fetch all rows for a SELECT query. */
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];

  /** Fetch the first row for a SELECT query, or undefined. */
  get<T = Record<string, unknown>>(
    sql: string,
    ...params: unknown[]
  ): T | undefined;

  /** Execute one or more raw SQL statements (no bound params). */
  exec(sql: string): void;

  /** Run `fn` inside an explicit transaction; commit on success, rollback on throw. */
  transaction<T>(fn: (executor: SqlExecutor) => T): T;
}
