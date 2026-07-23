/**
 * Database bridge store.
 *
 * Holds references to the expo-sqlite SQLiteDatabase and the Drizzle ORM
 * wrapper so that Zustand stores (module-level singletons) can access the
 * database without prop-drilling through React Context.
 *
 * Initialized once by DatabaseProvider on app startup.
 */

import { create } from "zustand";
import type { SQLiteDatabase } from "expo-sqlite";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import type * as schema from "@siltflow/shared-db/schema";

export type DrizzleDB = ExpoSQLiteDatabase<typeof schema>;

interface DBState {
  sqlite: SQLiteDatabase | null;
  db: DrizzleDB | null;
  ready: boolean;
  setDatabase: (sqlite: SQLiteDatabase, db: DrizzleDB) => void;
}

export const useDBStore = create<DBState>((set) => ({
  sqlite: null,
  db: null,
  ready: false,
  setDatabase: (sqlite, db) => set({ sqlite, db, ready: true }),
}));

/** Get the raw SQLiteDatabase (for raw-SQL services). Throws if not ready. */
export function getSQLite(): SQLiteDatabase {
  const { sqlite, ready } = useDBStore.getState();
  if (!ready || !sqlite) {
    throw new Error(
      "Database not initialized. Ensure <DatabaseProvider> wraps the app root.",
    );
  }
  return sqlite;
}

/** Get the Drizzle ORM instance (for Drizzle-based services). Throws if not ready. */
export function getDrizzle(): DrizzleDB {
  const { db, ready } = useDBStore.getState();
  if (!ready || !db) {
    throw new Error(
      "Database not initialized. Ensure <DatabaseProvider> wraps the app root.",
    );
  }
  return db;
}
