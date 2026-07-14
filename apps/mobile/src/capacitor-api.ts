/**
 * Capacitor API adapter — replaces `window.siltflow` API from Electron.
 *
 * Mobile app doesn't have Electron IPC, so we implement the same interface
 * using Capacitor plugins. Use `@capacitor-community/sqlite` for DB,
 * `@capacitor/preferences` for config, and `@siltflow/edge-tts` for TTS.
 *
 * This module should be imported early in boot and sets up window.siltflow.
 */

import { Communicate, listVoices } from "@siltflow/edge-tts";
import { runSql, executeSql } from "./database";

// ── Module-level state ───────────────────────────────────────────────────

let _ttsCacheDir = "";

/**
 * Set the TTS cache directory.
 */
export function setTtsCacheDir(dir: string) {
  _ttsCacheDir = dir;
}

// ── Voice cache ──────────────────────────────────────────────────────────

let _cachedVoices: string[] | null = null;

// ── API object ───────────────────────────────────────────────────────────

export interface SiltflowMobileAPI {
  // DB operations (used by stores)
  db: {
    get: (id: string, table: string) => Promise<any | null>;
    getAll: (table: string) => Promise<any[]>;
    save: (table: string, data: Record<string, any>) => Promise<void>;
    remove: (id: string, table: string, idColumn?: string) => Promise<void>;
  };
  // TTS
  tts: {
    speak: (text: string, options?: { voice?: string; rate?: string; volume?: string; pitch?: string }) => Promise<ArrayBuffer>;
    listVoices: () => Promise<string[]>;
  };
  // Config
  configGetAll: () => Promise<Record<string, string>>;
  configSet: (key: string, value: string) => Promise<void>;
  // Clipboard
  copyToClipboard: (text: string) => Promise<void>;
  // External links
  openExternal: (url: string) => Promise<void>;
  // File
  selectPdf: () => Promise<{ id: string; title: string }[] | null>;
  loadFile: (path: string) => Promise<ArrayBuffer>;
}

// ── Implementation ───────────────────────────────────────────────────────

async function dbGet(id: string, table: string): Promise<any | null> {
  const rows = await executeSql(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return rows.length > 0 ? rows[0] : null;
}

async function dbGetAll(table: string): Promise<any[]> {
  return await executeSql(`SELECT * FROM ${table}`);
}

async function dbSave(table: string, data: Record<string, any>): Promise<void> {
  const keys = Object.keys(data);
  const values = keys.map((k) => data[k]);
  const placeholders = keys.map(() => "?").join(", ");
  const cols = keys.join(", ");
  const updates = keys.map((k) => `${k} = ?`).join(", ");

  await runSql(
    `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`,
    values,
  );
}

async function dbRemove(id: string, table: string, idColumn = "id"): Promise<void> {
  await runSql(`DELETE FROM ${table} WHERE ${idColumn} = ?`, [id]);
}

async function speak(
  text: string,
  options: { voice?: string; rate?: string; volume?: string; pitch?: string } = {},
): Promise<ArrayBuffer> {
  const voice = options.voice || "en-US-EmmaMultilingualNeural";
  const rate = options.rate || "+0%";
  const volume = options.volume || "+0%";
  const pitch = options.pitch || "+0Hz";

  const tts = new Communicate(text, { voice, rate, volume, pitch });
  const audioChunks: Uint8Array[] = [];

  for await (const chunk of tts.stream()) {
    if (chunk.type === "audio") {
      audioChunks.push(chunk.data);
    }
  }

  // Concatenate all audio chunks
  const totalLength = audioChunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of audioChunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer as ArrayBuffer;
}

async function ttsListVoices(): Promise<string[]> {
  if (_cachedVoices) return _cachedVoices;
  try {
    const voices = await listVoices();
    _cachedVoices = voices.map((v: any) => v.ShortName);
    return _cachedVoices!;
  } catch {
    return [];
  }
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    const { Clipboard } = await import("@capacitor/clipboard");
    await Clipboard.write({ string: text });
  } catch {
    // Fallback: use the modern Clipboard API
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }
}

async function openExternal(url: string): Promise<void> {
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } catch {
    window.open(url, "_blank");
  }
}

async function selectPdf(): Promise<{ id: string; title: string }[] | null> {
  return null; // PDF selection not yet implemented for mobile
}

async function loadFile(path: string): Promise<ArrayBuffer> {
  try {
    const { Filesystem } = await import("@capacitor/filesystem");
    const result = await Filesystem.readFile({ path });
    // Result.data is a base64 string (type: string)
    const binaryStr = atob(result.data as string);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  } catch (err) {
    throw new Error(`Failed to load file: ${err}`);
  }
}

// ── Build and export the API ────────────────────────────────────────────

export const mobileAPI: SiltflowMobileAPI = {
  db: {
    get: dbGet,
    getAll: dbGetAll,
    save: dbSave,
    remove: dbRemove,
  },
  tts: {
    speak,
    listVoices: ttsListVoices,
  },
  configGetAll: async () => {
    const { configGetAll } = await import("../config");
    return configGetAll();
  },
  configSet: async (key: string, value: string) => {
    const { configSet } = await import("../config");
    return configSet(key, value);
  },
  copyToClipboard,
  openExternal,
  selectPdf,
  loadFile,
};

/**
 * Initialize the API adapter — exports `mobileAPI` for stores to use.
 * Call this after `initDatabase()` during app boot.
 */
export function initMobileAPI(): void {
  // Nothing special needed — stores import `mobileAPI` directly.
  // In the future, we could set `window.siltflow = mobileAPI`.
}
