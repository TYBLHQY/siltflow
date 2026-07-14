// @ts-check
/* eslint-disable */
/**
 * Standalone test script for @siltflow/edge-tts.
 * Runs in Node.js 21+ (or Node 18 with --experimental-websocket).
 *
 * Usage: node packages/edge-tts/test/test.mjs
 */

import { createHash, randomUUID } from "node:crypto";
import { open, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import WebSocket from "ws"; // must be installed in edge-tts package

// ── Constants (matching Python edge-tts) ──────────────────────────
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const BASE_URL = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";
const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const SEC_MS_GEC_VERSION = "1-143.0.3650.75";
const DEFAULT_VOICE = "en-US-EmmaMultilingualNeural";
const WIN_EPOCH = 11644473600;
const TICKS_PER_SECOND = 10_000_000;

// ── DRM (matching Python edge-tts) ────────────────────────────────
let clockSkewSeconds = 0.0;

function getUnixTimestamp() {
  return Date.now() / 1000 + clockSkewSeconds;
}

function generateSecMsGec() {
  let ticks = getUnixTimestamp();
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;             // round to 5 min
  ticks *= TICKS_PER_SECOND;        // convert to 100ns

  const strToHash = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
  return createHash("sha256").update(strToHash, "ascii").digest("hex").toUpperCase();
}

function generateMuid() {
  return randomUUID().replace(/-/g, "").toUpperCase();
}

function dateToString() {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ` +
    `${String(d.getUTCDate()).padStart(2, "0")} ${d.getUTCFullYear()} ` +
    `${String(d.getUTCHours()).padStart(2, "0")}:` +
    `${String(d.getUTCMinutes()).padStart(2, "0")}:` +
    `${String(d.getUTCSeconds()).padStart(2, "0")} ` +
    `GMT+0000 (Coordinated Universal Time)`;
}

function connectId() {
  return randomUUID().replace(/-/g, "");
}

// ── Voice name (matching Python __post_init__) ────────────────────
function toLongVoiceName(shortName) {
  // "en-US-EmmaMultilingualNeural" → "Microsoft Server Speech Text to Speech Voice (en-US, EmmaMultilingualNeural)"
  const match = shortName.match(/^([a-z]{2,})-([A-Z]{2,})-(.+Neural)$/);
  if (!match) return shortName; // already long form or unknown format
  let lang = match[1];
  let region = match[2];
  let name = match[3];
  if (name.includes("-")) {
    const dashIdx = name.indexOf("-");
    region = `${region}-${name.slice(0, dashIdx)}`;
    name = name.slice(dashIdx + 1);
  }
  return `Microsoft Server Speech Text to Speech Voice (${lang}-${region}, ${name})`;
}

// ── SSML (matching Python mkssml) ─────────────────────────────────
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
          .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");
}

function mkssml(voice, rate, volume, pitch, text) {
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${voice}'>` +
    `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
    `${text}</prosody></voice></speak>`;
}

function ssmlHeadersPlusData(requestId, timestamp, ssml) {
  return `X-RequestId:${requestId}\r\n` +
    `Content-Type:application/ssml+xml\r\n` +
    `X-Timestamp:${timestamp}Z\r\n` +    // trailing Z is a Microsoft Edge bug, matched from Python
    `Path:ssml\r\n\r\n` +
    `${ssml}`;
}

function buildSpeechConfig(wordBoundary) {
  const wd = wordBoundary ? "true" : "false";
  const sq = wordBoundary ? "false" : "true";
  const timestamp = dateToString();
  return `X-Timestamp:${timestamp}\r\n` +
    `Content-Type:application/json; charset=utf-8\r\n` +
    `Path:speech.config\r\n\r\n` +
    `{"context":{"synthesis":{"audio":{"metadataoptions":{` +
    `"sentenceBoundaryEnabled":"${sq}","wordBoundaryEnabled":"${wd}"` +
    `},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
}

// ── Text splitter (matching Python) ────────────────────────────────
function splitTextByByteLength(text, maxBytes) {
  if (!text || text.length === 0) return [""];
  const encoded = Buffer.byteLength(text, "utf-8");
  if (encoded <= maxBytes) return [text];

  const chunks = [];
  let textBuf = Buffer.from(text, "utf-8");

  while (textBuf.length > maxBytes) {
    // Find last newline or space within limit
    let splitAt = textBuf.lastIndexOf(0x0a, maxBytes - 1); // \n
    if (splitAt < 0) splitAt = textBuf.lastIndexOf(0x20, maxBytes - 1); // space

    if (splitAt < 0) {
      // UTF-8 safe split: walk backwards from maxBytes to find a safe boundary
      splitAt = maxBytes;
      while (splitAt > 0) {
        try {
          // Check if textBuf.slice(0, splitAt) decodes as valid UTF-8
          textBuf.slice(0, splitAt).toString("utf-8");
          break;
        } catch {
          splitAt--;
        }
      }
    }

    // XML entity adjust
    if (splitAt > 0) {
      const beforeSlice = textBuf.slice(0, splitAt);
      const ampIdx = beforeSlice.lastIndexOf(0x26); // &
      const semiIdx = beforeSlice.lastIndexOf(0x3b); // ;
      if (ampIdx >= 0 && (semiIdx < 0 || semiIdx < ampIdx)) {
        splitAt = ampIdx;
      }
    }

    if (splitAt <= 0) splitAt = maxBytes;

    const chunk = textBuf.slice(0, splitAt).toString("utf-8").trim();
    if (chunk) chunks.push(chunk);
    textBuf = textBuf.slice(splitAt || 1);
  }

  const remaining = textBuf.toString("utf-8").trim();
  if (remaining) chunks.push(remaining);

  return chunks;
}

// ── Communicate test ──────────────────────────────────────────────

let testStep = 0;

async function testConnection(opts = {}) {
  const useLongVoice = opts.useLongVoice !== false; // default true
  const voice = DEFAULT_VOICE;
  const longVoice = useLongVoice ? toLongVoiceName(voice) : voice;
  const text = "Hello, this is a test of the edge TTS service.";
  const muid = generateMuid();
  const cid = connectId();
  const token = generateSecMsGec();

  console.log(`\n=== Test ${++testStep} ===`);
  console.log(`Voice: ${longVoice}`);
  console.log(`Text: "${text}"`);
  console.log(`ConnectId: ${cid}`);

  const url = `${WSS_URL}&ConnectionId=${cid}&Sec-MS-GEC=${token}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&muid=${muid}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws?.close();
      reject(new Error(`TIMEOUT after 25s`));
    }, 25000);

    let ws;
    try {
      ws = new WebSocket(url, undefined, {
        headers: {
          "Pragma": "no-cache",
          "Cache-Control": "no-cache",
          "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
          "Sec-WebSocket-Version": "13",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Accept-Language": "en-US,en;q=0.9",
          "Cookie": `muid=${muid};`,
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      return reject(new Error(`WebSocket constructor failed: ${err.message}`));
    }

    const receivedAudio = [];
    const receivedMetadata = [];

    ws.on("open", () => {
      console.log("  ✓ WebSocket connected");

      // Send speech.config
      const configMsg = buildSpeechConfig(true);
      ws.send(configMsg);
      console.log("  → sent speech.config");

      // Send SSML
      const ssml = mkssml(longVoice, "+0%", "+0%", "+0Hz", escapeXml(text));
      const ssmlFull = ssmlHeadersPlusData(connectId(), dateToString(), ssml);
      ws.send(ssmlFull);
      console.log("  → sent SSML");
    });

    ws.on("error", (err) => {
      console.log(`  ✗ WebSocket error event: ${err.message}`);
      // Don't reject immediately — on close will fire too
    });

    ws.on("upgrade", (req) => {
      console.log(`  WebSocket upgrade: ${req.statusCode}`);
    });

    ws.on("unexpected-response", (req, res) => {
      clearTimeout(timeout);
      // Collect the response body for debugging
      let body = "";
      res.on("data", (chunk) => body += chunk.toString());
      res.on("end", () => {
        console.log(`  ✗ Server responded with ${res.statusCode}: ${body.slice(0, 200)}`);
        reject(new Error(`Server rejected upgrade with ${res.statusCode}: ${body.slice(0, 100)}`));
      });
    });

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        const buf = Buffer.from(data);
        if (buf.length < 2) return;
        const headerLen = buf.readUInt16BE(0);
        const audioData = buf.slice(2 + headerLen);
        const headerStr = buf.slice(2, 2 + headerLen).toString("utf-8");

        const headers = {};
        for (const line of headerStr.split("\r\n")) {
          const idx = line.indexOf(":");
          if (idx > 0) headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
        }

        if (headers["content-type"] === "audio/mpeg" && audioData.length > 0) {
          receivedAudio.push(audioData);
          const total = receivedAudio.reduce((s, c) => s + c.length, 0);
          console.log(`  [audio] +${audioData.length} B = ${total} B`);
        }
      } else {
        const msg = data.toString("utf-8");
        const idx = msg.indexOf("\r\n\r\n");
        const headerStr = idx >= 0 ? msg.slice(0, idx) : msg;
        const body = idx >= 0 ? msg.slice(idx + 4) : "";
        const headers = {};
        for (const line of headerStr.split("\r\n")) {
          const ci = line.indexOf(":");
          if (ci > 0) headers[line.slice(0, ci).trim().toLowerCase()] = line.slice(ci + 1).trim();
        }

        const path = headers["path"] || "";
        if (path === "turn.start") {
          console.log("  [turn.start]");
        } else if (path === "turn.end") {
          console.log("  [turn.end]");
          clearTimeout(timeout);
          ws.close();
        } else if (path === "response") {
          console.log("  [response]");
        } else if (path === "response.metadata") {
          try {
            const parsed = JSON.parse(body);
            const items = parsed.Metadata || [parsed];
            for (const item of items) {
              if (item.Type === "WordBoundary") {
                receivedMetadata.push(item);
                console.log(`  [WordBoundary] "${item.Data?.text?.Text}" offset=${item.Data?.Offset} duration=${item.Data?.Duration}`);
              }
            }
          } catch (e) {
            console.log(`  [metadata parse error] ${e.message}`);
          }
        } else if (path === "audio.metadata") {
          console.log(`  [audio.metadata] (${body.length} bytes)`);
        } else {
          console.log(`  [${path}] ${body.slice(0, 60)}`);
        }
      }
    });

    ws.on("close", (code, reason) => {
      console.log(`  ✓ WebSocket closed (code=${code}, reason="${(reason || "").toString()}")`);
      console.log(`  Audio: ${receivedAudio.length} chunks, ${receivedAudio.reduce((s, c) => s + c.length, 0)} bytes`);
      console.log(`  Metadata events: ${receivedMetadata.length}`);
      if (receivedAudio.length > 0) {
        clearTimeout(timeout);
        resolve({ audio: Buffer.concat(receivedAudio), metadata: receivedMetadata });
      } else {
        // Wait for error timeout if no audio and no close yet
      }
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log(">>> @siltflow/edge-tts standalone test <<<\n");

  // 1. Test voice name
  console.log("--- Voice Name ---");
  const short = "en-US-EmmaMultilingualNeural";
  const long = toLongVoiceName(short);
  console.log(`  Short: ${short}`);
  console.log(`  Long:  ${long}`);

  // 2. Test DRM token generation
  console.log("\n--- DRM Token ---");
  const token = generateSecMsGec();
  console.log(`  Token: ${token} (${token.length} hex chars)`);

  // 3. Test text splitter
  console.log("\n--- Text Splitter ---");
  const testText = "Hello world. This is a test of the text splitter. ".repeat(10);
  const chunks = splitTextByByteLength(testText, 512);
  console.log(`  Input: ${Buffer.byteLength(testText, "utf-8")} bytes`);
  console.log(`  Chunks: ${chunks.length}`);
  chunks.forEach((c, i) => console.log(`  [${i}] ${Buffer.byteLength(c, "utf-8")} bytes: "${c.slice(0, 40)}..."`));

  // 4. Test with LONG voice name (as Python does)
  console.log("\n--- Test with long voice name ---");
  try {
    const result = await testConnection({ useLongVoice: true });
    const outDir = "/tmp/edge-tts-test";
    if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
    const outPath = `${outDir}/output-long.mp3`;
    await writeFile(outPath, result.audio);
    console.log(`\n✓ Audio saved to ${outPath} (${result.audio.length} bytes)`);
  } catch (err) {
    console.error(`\n✗ LONG VOICE TEST FAILED: ${err.message}`);
  }

  // 5. Test with SHORT voice name
  console.log("\n--- Test with short voice name ---");
  try {
    const result = await testConnection({ useLongVoice: false });
    const outDir = "/tmp/edge-tts-test";
    if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
    const outPath = `${outDir}/output-short.mp3`;
    await writeFile(outPath, result.audio);
    console.log(`\n✓ Audio saved to ${outPath} (${result.audio.length} bytes)`);
  } catch (err) {
    console.error(`\n✗ SHORT VOICE TEST FAILED: ${err.message}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
