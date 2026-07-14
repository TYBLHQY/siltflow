/**
 * Config persistence via expo-secure-store.
 * Replaces desktop's vault config (config.json on filesystem).
 * Used by Zustand stores to persist user settings.
 */
import * as SecureStore from "expo-secure-store";

const CONFIG_KEY = "siltflow_config";

/**
 * Get all config values as a flat record.
 * Merged from a single JSON blob stored in SecureStore.
 */
export async function configGetAll(): Promise<Record<string, unknown>> {
  try {
    const raw = await SecureStore.getItemAsync(CONFIG_KEY);
    if (raw) return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // SecureStore.getItemAsync doesn't throw on missing key, but be safe
  }
  return {};
}

/**
 * Merge new values into the stored config.
 * Works like desktop's vaultConfigSet — merges with existing values.
 */
export async function configSet(
  patch: Record<string, unknown>,
): Promise<void> {
  const existing = await configGetAll();
  const merged = { ...existing, ...patch };
  await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(merged));
}

/**
 * Get a single config value by key.
 */
export async function configGet<T = unknown>(key: string): Promise<T | undefined> {
  const all = await configGetAll();
  return all[key] as T | undefined;
}

/**
 * Delete a single config key.
 */
export async function configRemove(key: string): Promise<void> {
  const all = await configGetAll();
  delete all[key];
  await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(all));
}

/**
 * Clear all stored config.
 */
export async function configClear(): Promise<void> {
  await SecureStore.deleteItemAsync(CONFIG_KEY);
}
