/**
 * expo-sqlite database initialization and access.
 * Provides a singleton database instance with the Siltflow schema.
 */
import * as SQLite from "expo-sqlite";
import { CREATE_TABLES_SQL } from "./schema";

let db: SQLite.SQLiteDatabase | null = null;

/** Database name used for expo-sqlite storage. */
const DB_NAME = "siltflow.db";

/**
 * Initialize (or open) the database and ensure all tables exist.
 * Call once at app boot before using any store.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync(DB_NAME);

  // Enable WAL mode for better concurrent performance
  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.execAsync("PRAGMA foreign_keys = ON");

  // Create tables
  await db.execAsync(CREATE_TABLES_SQL);

  return db;
}

/**
 * Get the singleton database instance.
 * Throws if initDatabase() hasn't been called yet.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error(
      "Database not initialized — call initDatabase() at app boot",
    );
  }
  return db;
}

/**
 * Current timestamp as ISO string — convenience helper.
 */
export function nowISO(): string {
  return new Date().toISOString();
}
