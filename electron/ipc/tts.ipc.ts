import { ipcMain } from "electron";
import { createHash } from "node:crypto";
import { readFile, unlink, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { UniversalEdgeTTS, listVoices } from "edge-tts-universal";

let vaultCacheDir = "";

export function setTtsCacheDir(dir: string) {
  vaultCacheDir = dir;
}

// In-flight dedup keyed by the cache key: if two tts:speak calls arrive for
// the same (text, voice, rate, volume, pitch) while the first is still
// synthesizing, the second awaits the same promise instead of issuing a
// duplicate network synthesize + cache write.
const inFlightSynthesis = new Map<string, Promise<number[]>>();

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

      // Check cache first — async read (no blocking existsSync+readFile pair).
      const key = cacheKey(text, voice, rate, volume, pitch);
      const cachePath = vaultCacheDir ? join(vaultCacheDir, `${key}.mp3`) : "";
      if (cachePath) {
        try {
          const buf = await readFile(cachePath);
          return Array.from(new Uint8Array(buf));
        } catch {
          /* cache miss → synthesize */
        }
      }

      // In-flight dedup: share the synthesis promise for identical requests
      // instead of synthesizing the same text twice concurrently. The
      // synchronous section between the first await and this check is atomic
      // on the event loop, so concurrent arrivals can't double-synthesize.
      let promise = cachePath ? inFlightSynthesis.get(key) : undefined;
      if (!promise) {
        // Synthesize in memory via edge-tts-universal (no temp files). Throws
        // EdgeTTSException subclasses on network/protocol failure.
        promise = (async (): Promise<number[]> => {
          const tts = new UniversalEdgeTTS(text, voice, {
            rate,
            volume,
            pitch,
          });
          const result = await tts.synthesize();
          const buf = Buffer.from(await result.audio.arrayBuffer());
          return Array.from(new Uint8Array(buf));
        })();
        if (cachePath) {
          inFlightSynthesis.set(key, promise);
          void promise
            .finally(() => inFlightSynthesis.delete(key))
            .catch(() => {});
        }
      }
      const audioData = await promise;

      // Cache the result
      if (cachePath) {
        try {
          await mkdir(dirname(cachePath), { recursive: true });
          await writeFile(cachePath, Buffer.from(audioData));
          trimCache().catch(() => {});
        } catch {
          /* cache write best effort */
        }
      }

      return audioData;
    },
  );

  ipcMain.handle("tts:listVoices", async () => {
    const voices = await listVoices();
    return voices.map((v) => ({ shortName: v.ShortName, locale: v.Locale }));
  });
}
