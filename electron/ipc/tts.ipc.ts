import { ipcMain } from "electron";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { UniversalEdgeTTS, listVoices } from "edge-tts-universal";

let vaultCacheDir = "";

export function setTtsCacheDir(dir: string) {
  vaultCacheDir = dir;
}

/** Build a stable cache key from (text, voice, rate, volume, pitch). */
function cacheKey(
  text: string,
  voice: string,
  rate: string,
  volume: string,
  pitch: string,
): string {
  const hash = createHash("sha256");
  hash.update(`${text}\x00${voice}\x00${rate}\x00${volume}\x00${pitch}`);
  return hash.digest("hex").slice(0, 32);
}

const MAX_CACHE_FILES = 200;

/** Keep at most MAX_CACHE_FILES in the tts cache dir, removing oldest first. */
async function trimCache(): Promise<void> {
  if (!vaultCacheDir) return;
  try {
    const { readdir, stat } = await import("node:fs/promises");
    const files = await readdir(vaultCacheDir);
    if (files.length <= MAX_CACHE_FILES) return;

    const entries = await Promise.all(
      files.map(async (f) => {
        const p = join(vaultCacheDir, f);
        const s = await stat(p);
        return { name: f, path: p, mtime: s.mtimeMs };
      }),
    );
    entries.sort((a, b) => a.mtime - b.mtime);

    const toDelete = entries.slice(0, entries.length - MAX_CACHE_FILES);
    for (const e of toDelete) {
      unlink(e.path).catch(() => {});
    }
  } catch {
    /* best effort */
  }
}

export function registerTTSHandlers() {
  ipcMain.handle(
    "tts:speak",
    async (
      _event,
      text: string,
      options: {
        voice?: string;
        rate?: string;
        volume?: string;
        pitch?: string;
      },
    ) => {
      const voice = options.voice ?? "en-US-EmmaMultilingualNeural";
      const rate = options.rate ?? "+0%";
      const volume = options.volume ?? "+0%";
      const pitch = options.pitch ?? "+0Hz";

      // Check cache first
      const key = cacheKey(text, voice, rate, volume, pitch);
      const cachePath = vaultCacheDir ? join(vaultCacheDir, `${key}.mp3`) : "";
      if (cachePath && existsSync(cachePath)) {
        const buf = await readFile(cachePath);
        return Array.from(new Uint8Array(buf));
      }

      // Synthesize in memory via edge-tts-universal (no temp files). Throws
      // EdgeTTSException subclasses on network/protocol failure.
      const tts = new UniversalEdgeTTS(text, voice, { rate, volume, pitch });
      const result = await tts.synthesize();
      const buf = Buffer.from(await result.audio.arrayBuffer());

      // Cache the result
      if (cachePath) {
        try {
          if (!existsSync(vaultCacheDir))
            mkdirSync(vaultCacheDir, { recursive: true });
          await writeFile(cachePath, buf);
          trimCache().catch(() => {});
        } catch {
          /* cache write best effort */
        }
      }

      return Array.from(new Uint8Array(buf));
    },
  );

  ipcMain.handle("tts:listVoices", async () => {
    const voices = await listVoices();
    return voices.map((v) => ({ shortName: v.ShortName, locale: v.Locale }));
  });
}
