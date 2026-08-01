import { test, expect } from "@playwright/test";
import { launchApp, seedDocument, openDocument, waitForPdf } from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

// End-to-end verification that a real TTS speak call through the app's IPC
// returns audio bytes and lands in the sha256 disk cache (one new .mp3 file
// per unique text/voice/rate/volume/pitch key). TTS now runs in-process via
// edge-tts-universal, so there are no temp dirs to leak anymore.
//
// The cache dir may not exist before the first speak (launchApp bypasses
// ensureVaultStructure), so the assertion is relative: speak creates it if
// needed and writes exactly one new .mp3.
//
// NOTE: requires network — edge-tts synthesizes audio in the cloud. Offline,
// the audio assertion fails, so skip it on air-gapped machines with
// `--grep-invert "tts speak"`.
test("tts speak returns audio bytes and writes the disk cache", async () => {
  const { app, window, vault } = await launchApp((vaultDir) => {
    seedDocument(vaultDir, FIXTURE_PDF);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    const cacheDir = path.join(vault, ".siltflow", "tts-cache");
    const before = existsSync(cacheDir)
      ? readdirSync(cacheDir).filter((f) => f.endsWith(".mp3"))
      : [];

    // Fire a real TTS speak through the renderer → main IPC handler. First
    // call synthesizes over the network and writes the cache.
    const audio = (await window.evaluate(async () => {
      return await window.siltflow.tts.speak("hello", {});
    })) as number[];
    expect(audio.length).toBeGreaterThan(0);

    // Second call with the same key must hit the cache (byte-identical).
    const cached = (await window.evaluate(async () => {
      return await window.siltflow.tts.speak("hello", {});
    })) as number[];
    expect(cached).toEqual(audio);

    // Exactly one new .mp3 cache file was written.
    const after = readdirSync(cacheDir).filter((f) => f.endsWith(".mp3"));
    expect(after.length).toBe(before.length + 1);
  } finally {
    await app.close();
  }
});
