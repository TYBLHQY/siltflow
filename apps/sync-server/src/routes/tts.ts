/**
 * TTS routes — server-side Edge TTS proxy.
 *
 * Spawns the `edge-tts` Python CLI (same as desktop) and returns MP3 audio
 * to authenticated mobile clients. No client-side crypto or WebSocket needed.
 *
 * Endpoints:
 *   POST /api/tts/speak   — synthesize text → audio/mpeg
 *   GET  /api/tts/voices  — list available voices
 *   GET  /api/tts/status  — check if edge-tts CLI is installed
 */

import { Hono } from "hono";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Variables } from "../types";

// ── Types ─────────────────────────────────────────────────────────────

const TTS_SPEAK_SCHEMA = {
  text: "string (required)",
  voice: "string (optional, default: en-US-EmmaMultilingualNeural)",
  rate: "string (optional, default: +0%)",
  volume: "string (optional, default: +0%)",
  pitch: "string (optional, default: +0Hz)",
};

interface TTSSpeakBody {
  text: string;
  voice?: string;
  rate?: string;
  volume?: string;
  pitch?: string;
}

// ── Cache (same logic as desktop tts.ipc.ts) ────────────────────────

let _cacheDir: string | null = null;

function getCacheDir(c: any): string {
  if (_cacheDir) return _cacheDir;
  const dataDir = c.var.config?.dataDir ?? join(tmpdir(), "siltflow-server");
  _cacheDir = join(dataDir, "tts-cache");
  return _cacheDir;
}

function cacheKey(text: string, voice: string, rate: string, volume: string, pitch: string): string {
  const hash = createHash("sha256");
  hash.update(`${text}\x00${voice}\x00${rate}\x00${volume}\x00${pitch}`);
  return hash.digest("hex").slice(0, 32);
}

const MAX_CACHE_FILES = 200;

function trimCache(cacheDir: string): void {
  try {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const files = readdirSync(cacheDir);
    if (files.length <= MAX_CACHE_FILES) return;

    const entries = files
      .map((f: string) => {
        const p = join(cacheDir, f);
        const s = statSync(p);
        return { name: f, path: p, mtime: s.mtimeMs };
      })
      .sort((a: any, b: any) => a.mtime - b.mtime);

    const toDelete = entries.slice(0, entries.length - MAX_CACHE_FILES);
    for (const e of toDelete) {
      try { unlinkSync(e.path); } catch { /* best effort */ }
    }
  } catch { /* best effort */ }
}

function ensureCacheDir(cacheDir: string): void {
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Spawn edge-tts and collect stdout. */
function spawnEdgeTts(
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: Buffer; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("edge-tts", args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
    });

    const chunks: Buffer[] = [];
    let stderr = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(new Error("edge-tts not installed. Run: pip install edge-tts"));
      } else {
        reject(new Error(`edge-tts failed to start: ${err.message}`));
      }
    });

    proc.on("exit", (code) => {
      const stdout = Buffer.concat(chunks);
      resolve({ stdout, stderr: stderr.trim(), code });
    });
  });
}

function isVoiceNotFound(stderr: string): boolean {
  return /Voice.*not found/i.test(stderr) || /Invalid voice/i.test(stderr);
}

/** Parse `edge-tts --list-voices` output into voice names and language groups. */
function parseVoiceList(stdout: string): { voices: string[]; groups: Record<string, string[]> } {
  const voices: string[] = [];
  const groups: Record<string, string[]> = {};

  for (const line of stdout.split("\n")) {
    const parts = line.trim().split(/\s+/);
    const name = parts[0];
    if (!name || name === "Name" || !name.includes("-")) continue;

    voices.push(name);

    // Group by BCP 47 prefix: "en-US-EmmaNeural" → group key "en-US"
    const match = name.match(/^([a-z]{2}-[A-Z]{2})-/);
    if (match) {
      const lang = match[1];
      if (!groups[lang]) groups[lang] = [];
      groups[lang].push(name);
    }
  }

  return { voices, groups };
}

// ── Routes ───────────────────────────────────────────────────────────

export const ttsRoutes = new Hono<{ Variables: Variables }>()
  /**
   * POST /api/tts/speak
   * Synthesize text to speech using Microsoft Edge TTS.
   *
   * Body: { text: string, voice?: string, rate?: string, volume?: string, pitch?: string }
   * Returns: audio/mpeg binary
   */
  .post("/speak", async (c) => {
    let body: TTSSpeakBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json", message: "Request body must be valid JSON" }, 400);
    }

    const text = body.text?.trim();
    if (!text) {
      return c.json({ error: "missing_text", message: "text is required" }, 400);
    }
    if (text.length > 5000) {
      return c.json({ error: "text_too_long", message: "Text must be ≤ 5000 characters" }, 400);
    }

    const voice = body.voice || "en-US-EmmaMultilingualNeural";
    const rate = body.rate || "+0%";
    const volume = body.volume || "+0%";
    const pitch = body.pitch || "+0Hz";

    // ── Cache check ──────────────────────────────────────────────────
    const cacheDir = getCacheDir(c);
    const key = cacheKey(text, voice, rate, volume, pitch);
    const cachePath = join(cacheDir, `${key}.mp3`);

    if (existsSync(cachePath)) {
      try {
        const cached = readFileSync(cachePath);
        return new Response(cached, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(cached.length),
            "X-TTS-Cache": "hit",
          },
        });
      } catch { /* cache read failed, re-generate */ }
    }

    // ── Synthesize ───────────────────────────────────────────────────
    try {
      const { stdout, stderr, code } = await spawnEdgeTts(
        [
          "--text", text,
          "--voice", voice,
          "--rate", rate,
          "--volume", volume,
          "--pitch", pitch,
          "--write-media", "-",
        ],
        30_000,
      );

      if (code !== 0 || stdout.length === 0) {
        if (isVoiceNotFound(stderr)) {
          return c.json({ error: "voice_not_found", message: stderr }, 400);
        }
        return c.json({
          error: "tts_failed",
          message: stderr || "edge-tts returned empty audio",
        }, 502);
      }

      // ── Cache the result ─────────────────────────────────────────
      try {
        ensureCacheDir(cacheDir);
        writeFileSync(cachePath, stdout);
        trimCache(cacheDir);
      } catch { /* cache write best effort */ }

      return new Response(stdout, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(stdout.length),
          "X-TTS-Cache": "miss",
        },
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("edge-tts not installed")) {
        return c.json({ error: "not_installed", message: msg }, 503);
      }
      if (msg.includes("timed out")) {
        return c.json({ error: "timeout", message: msg }, 504);
      }
      return c.json({ error: "synthesis_error", message: msg }, 500);
    }
  })

  /**
   * GET /api/tts/voices
   * List available Edge TTS voices grouped by language.
   *
   * Returns: { voices: string[], groups: Record<string, string[]> }
   */
  .get("/voices", async (c) => {
    try {
      const { stdout, stderr, code } = await spawnEdgeTts(["--list-voices"], 10_000);

      if (code !== 0 && code !== null) {
        return c.json({ error: "list_failed", message: stderr || `exit code ${code}` }, 502);
      }

      const result = parseVoiceList(stdout.toString());

      if (result.voices.length === 0) {
        return c.json({ error: "no_voices", message: "Failed to parse voice list" }, 500);
      }

      return c.json(result);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("edge-tts not installed")) {
        return c.json({ error: "not_installed", message: msg }, 503);
      }
      return c.json({ error: "voice_list_error", message: msg }, 500);
    }
  })

  /**
   * GET /api/tts/status
   * Check if edge-tts CLI is installed and available.
   *
   * Returns: { available: boolean, version?: string }
   */
  .get("/status", async (c) => {
    try {
      const { stdout } = await spawnEdgeTts(["--version"], 5000);
      const output = stdout.toString().trim();
      // Parse version from output like "edge-tts 7.2.8" or just "7.2.8"
      const version = output.replace(/^edge-tts\s+/i, "").trim() || output;
      return c.json({ available: true, version });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("edge-tts not installed") || msg.includes("ENOENT")) {
        return c.json({ available: false });
      }
      return c.json({ available: false, error: msg });
    }
  });
