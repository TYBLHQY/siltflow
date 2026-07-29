/**
 * Self-update route (CJS deployments only).
 *
 * POST /api/admin/update
 *   Fetches the newest server-v* GitHub Release, downloads server.cjs,
 *   atomically replaces the running bundle, then exits so systemd/pm2
 *   restarts the process.
 *
 * Query params:
 *   ?dryRun=1 — show what would happen without actually updating
 */

import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import type { Variables } from "../types";

// ── Config ──────────────────────────────────────────────────────────────────

const GITHUB_OWNER = "TYBLHQY";
const GITHUB_REPO = "siltflow";
const RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=10`;

// ── Helpers ─────────────────────────────────────────────────────────────────

interface GhRelease {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

interface GhAsset {
  name: string;
  browser_download_url: string;
}

/** Compare semver strings (v prefix optional). */
function isNewer(remote: string, local: string): boolean {
  const r = remote.replace(/^v/, "").split(".").map(Number);
  const l = local.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rn = r[i] ?? 0;
    const ln = l[i] ?? 0;
    if (rn > ln) return true;
    if (rn < ln) return false;
  }
  return false;
}

/** Find the newest server-v* release from the GitHub API response. */
function findServerRelease(releases: GhRelease[]): {
  tag: string;
  asset: GhAsset;
} | null {
  for (const r of releases) {
    if (!r.tag_name.startsWith("server-v")) continue;
    const cjs = r.assets.find((a) => a.name === "server.cjs");
    if (cjs) return { tag: r.tag_name, asset: cjs };
  }
  return null;
}

/** Guess the current running version.
 *
 * 1. CI-injected env var (SERVER_VERSION) — set by CI in latest-server.json
 * 2. Read from package.json in the same dir as the CJS bundle
 */
function getCurrentVersion(): string {
  // CI-injected
  if (process.env["SERVER_VERSION"]) return process.env["SERVER_VERSION"];

  // Read from the installed package.json (works in dev and CJS bundle)
  const candidates = [
    path.resolve(__dirname, "../package.json"),
    path.resolve(__dirname, "../../package.json"),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8")).version;
    } catch { /* try next */ }
  }
  return "0.0.0";
}

// ── Route ───────────────────────────────────────────────────────────────────

export const updateRoutes = new Hono<{ Variables: Variables }>()
  .post("/update", async (c) => {
    const currentVersion = getCurrentVersion();
    const dryRun = c.req.query("dryRun") === "1";

    // Fetch releases from GitHub
    let releases: GhRelease[];
    let resp: Response;
    try {
      resp = await fetch(RELEASES_API);
      if (!resp.ok) {
        return c.json(
          { error: `GitHub API returned ${resp.status}`, currentVersion },
          502,
        );
      }
      releases = (await resp.json()) as GhRelease[];
    } catch (err) {
      return c.json(
        { error: `Failed to reach GitHub API: ${(err as Error).message}`, currentVersion },
        502,
      );
    }

    // Find newest server-v*
    const found = findServerRelease(releases);
    if (!found) {
      return c.json(
        { error: "No server-v* release found", currentVersion },
        404,
      );
    }

    const remoteVersion = found.tag.replace("server-v", "");

    // Compare
    if (!isNewer(remoteVersion, currentVersion)) {
      return c.json({
        updated: false,
        reason: "already latest",
        currentVersion,
        remoteVersion,
      });
    }

    if (dryRun) {
      return c.json({
        updated: false,
        reason: "dry run — update would be performed",
        currentVersion,
        remoteVersion,
        asset: found.asset.browser_download_url,
      });
    }

    // Download new bundle to a temp file
    let body: ReadableStream<Uint8Array> | null;
    try {
      body = (await fetch(found.asset.browser_download_url)).body;
      if (!body) throw new Error("Empty response body");
    } catch (err) {
      return c.json(
        { error: `Download failed: ${(err as Error).message}` },
        502,
      );
    }

    // Write to temp file next to the running CJS bundle
    const target = path.resolve(__dirname, "server.cjs");
    const tmp = target + ".tmp";

    try {
      const chunks: Uint8Array[] = [];
      const reader = body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const buf = Buffer.concat(chunks);

      if (buf.length === 0) {
        return c.json({ error: "Downloaded file is empty" }, 502);
      }

      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, target); // atomic replace
    } catch (err) {
      // Clean up temp file on failure
      try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
      return c.json(
        { error: `Write failed: ${(err as Error).message}` },
        500,
      );
    }

    // Send success response, then exit — systemd/pm2 restarts
    const respPayload = {
      updated: true,
      currentVersion,
      remoteVersion,
      message: "Restarting…",
    };

    // Use setImmediate so the response is flushed before we exit
    setImmediate(() => {
      console.log(
        `[update] Replaced server.cjs: ${currentVersion} → ${remoteVersion}. Exiting for restart.`,
      );
      process.exit(0);
    });

    return c.json(respPayload);
  });
