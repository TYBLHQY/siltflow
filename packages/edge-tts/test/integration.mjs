// @ts-check
/* eslint-disable */
/**
 * Integration test for @siltflow/edge-tts built output.
 * Tests the Communicate class end-to-end with Microsoft Edge TTS.
 *
 * Usage: node packages/edge-tts/test/integration.mjs
 */

import { Communicate, listVoices } from "../dist/index.js";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

async function testListVoices() {
  console.log("\n--- Test listVoices() ---");
  try {
    const voices = await listVoices();
    console.log(`  ✓ ${voices.length} voices returned`);
    const samples = voices.slice(0, 3).map((v) => v.ShortName);
    console.log(`  Samples: ${samples.join(", ")}`);
    return true;
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
    return false;
  }
}

async function testSpeak(voice) {
  console.log(`\n--- Test Communicate with voice: ${voice} ---`);
  try {
    const tts = new Communicate("Hello, this is a test of the edge TTS library. It should produce clear audio output.", {
      voice,
      rate: "+0%",
      volume: "+0%",
      pitch: "+0Hz",
    });

    const chunks = [];
    for await (const chunk of tts.stream()) {
      chunks.push(chunk);
    }

    const audioChunks = chunks.filter((c) => c.type === "audio");
    const metadataChunks = chunks.filter(
      (c) => c.type === "WordBoundary" || c.type === "SentenceBoundary",
    );

    console.log(`  ✓ Audio chunks: ${audioChunks.length}`);
    console.log(`  ✓ Metadata events: ${metadataChunks.length}`);

    if (metadataChunks.length > 0) {
      const first = metadataChunks[0];
      if (first.type === "WordBoundary" || first.type === "SentenceBoundary") {
        console.log(`  First event: type=${first.type} text="${first.text}" offset=${first.offset} duration=${first.duration}`);
      }
    }

    if (audioChunks.length > 0) {
      const total = audioChunks.reduce((s, c) => s + c.data.length, 0);
      console.log(`  Total audio bytes: ${total}`);

      // Save to file
      const outDir = "/tmp/edge-tts-test";
      if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
      const outPath = `${outDir}/integration-${voice.replace(/[^a-zA-Z0-9]/g, "-")}.mp3`;
      const audioData = new Uint8Array(total);
      let offset = 0;
      for (const c of audioChunks) {
        audioData.set(c.data, offset);
        offset += c.data.length;
      }
      await writeFile(outPath, audioData);
      console.log(`  ✓ Audio saved to ${outPath}`);
      return true;
    }
    console.error("  ✗ No audio received");
    return false;
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(">>> @siltflow/edge-tts integration tests <<<");

  // 1. Test listVoices
  const voicesOk = await testListVoices();

  // 2. Test communicate
  const speakOk = await testSpeak("en-US-EmmaMultilingualNeural");

  // 3. Test with a different voice
  let speakOk2 = false;
  if (voicesOk) {
    speakOk2 = await testSpeak("zh-CN-XiaoxiaoMultilingualNeural");
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(`  listVoices: ${voicesOk ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`  Speak (Emma):   ${speakOk ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`  Speak (Xiaoxiao): ${speakOk2 ? "✓ PASS" : "✗ FAIL"}`);

  if (!speakOk && !speakOk2) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
