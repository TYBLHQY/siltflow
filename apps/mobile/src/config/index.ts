import { Preferences } from "@capacitor/preferences";

const KEYS_TO_SYNC = [
  "ai_profiles",
  "ai_active_profile",
  "fsrs_params",
  "style",
  "theme",
  "app_settings",
  "tts_config",
  "tts_voices",
] as const;

export type AsyncConfigKey = typeof KEYS_TO_SYNC[number];

/**
 * Get all persisted config values.
 */
export async function configGetAll(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const key of KEYS_TO_SYNC) {
    const { value } = await Preferences.get({ key });
    if (value != null) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Set a config value.
 */
export async function configSet(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value });
}

/**
 * Remove a config value.
 */
export async function configRemove(key: string): Promise<void> {
  await Preferences.remove({ key });
}
