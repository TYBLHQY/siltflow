import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import * as schema from "@siltflow/shared-db/schema";
import { SCHEMA_VERSION } from "@siltflow/shared-db/types";
import { initSchema } from "@siltflow/shared-db/migrations";
import { createExpoSqliteExecutor } from "@/lib/expo-sqlite-adapter";
import { useDBStore } from "@/stores/db.store";

// ── Types ────────────────────────────────────────────────────────────

type DrizzleDB = ExpoSQLiteDatabase<typeof schema>;

interface DatabaseContextValue {
  db: DrizzleDB;
  sqlite: SQLiteDatabase;
}

// ── Context ──────────────────────────────────────────────────────────

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────

export function DatabaseProvider({ children }: PropsWithChildren) {
  const value = useMemo(() => {
    // Open (or create) the SQLite database in the app's sandboxed directory.
    // enableChangeListener allows Drizzle's useLiveQuery to re-render on data changes.
    const sqlite = openDatabaseSync("siltflow.db", {
      enableChangeListener: true,
    });

    // PRAGMAs for performance and referential integrity
    sqlite.execSync("PRAGMA journal_mode = WAL");
    sqlite.execSync("PRAGMA foreign_keys = ON");

    // Run shared schema initialization (CREATE TABLE + version-gated migrations)
    const version = sqlite.getFirstSync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    const currentVersion = version?.user_version ?? 0;
    const executor = createExpoSqliteExecutor(sqlite);

    initSchema(executor, currentVersion);

    if (currentVersion < SCHEMA_VERSION) {
      sqlite.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    }

    // Wrap with Drizzle ORM
    const db = drizzle(sqlite, { schema });

    // Bridge: make the database available to Zustand stores
    useDBStore.getState().setDatabase(sqlite, db);

    return { db, sqlite };
  }, []);

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error(
      "useDatabase must be used within a <DatabaseProvider>. " +
        "Wrap your app root with <DatabaseProvider> in _layout.tsx.",
    );
  }
  return ctx;
}
