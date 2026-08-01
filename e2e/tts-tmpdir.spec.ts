import { test, expect } from "@playwright/test";
import { launchApp, seedDocument, openDocument, waitForPdf } from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

// One-off verification: after a real edge-tts call through the app's IPC,
// no `siltflow-tts-*` temp dir should remain (regression test for the
// unlink-vs-rmdir bug where tmp dirs leaked on every TTS playback).
//
// NOTE: requires network — edge-tts synthesizes audio in the cloud. Offline,
// the audio assertion fails (not the leak check), so skip it on air-gapped
// machines with `--grep-invert "tts speak"`.
test("tts speak leaves no temp dir behind", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocument(vault, FIXTURE_PDF);
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    const before = readdirSync(tmpdir()).filter((f) =>
      f.startsWith("siltflow-tts-"),
    ).length;

    // Fire a real TTS speak through the renderer → main IPC handler.
    const audio = (await window.evaluate(async () => {
      return await window.siltflow.tts.speak("hello", {});
    })) as number[];
    expect(audio.length).toBeGreaterThan(0);

    // The IPC resolves after the temp file is read; the cleanup runs before
    // resolve, so any leak is already visible.
    const after = readdirSync(tmpdir()).filter((f) =>
      f.startsWith("siltflow-tts-"),
    ).length;
    expect(after).toBe(before);
  } finally {
    await app.close();
  }
});
