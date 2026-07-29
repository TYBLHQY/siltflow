/**
 * Server update service (mobile-side).
 *
 * Checks the sync server's current version via /health, then calls
 * POST /api/admin/update to trigger a self-update of the server's
 * CJS bundle.  The server replaces its own file and exits; systemd/pm2
 * restarts it automatically.
 */

const GITHUB_OWNER = "TYBLHQY";
const GITHUB_REPO = "siltflow";
const RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=10`;

// ── Types ──────────────────────────────────────────────────────────────────

export interface ServerHealth {
  ok: boolean;
  version: string;
  uptime: number;
  db: string;
  timestamp: string;
}

interface GhRelease {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
}

export interface ServerUpdateResult {
  updated: boolean;
  currentVersion?: string;
  remoteVersion?: string;
  reason?: string;
  message?: string;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Fetch server health info (includes version). */
export async function fetchServerHealth(serverUrl: string): Promise<ServerHealth> {
  const resp = await fetch(`${serverUrl}/health`);
  if (!resp.ok) throw new Error(`Health check failed: HTTP ${resp.status}`);
  return resp.json() as Promise<ServerHealth>;
}

/** Find the newest server-v* tag and return the version string. */
export async function fetchLatestServerVersion(): Promise<string | null> {
  try {
    const resp = await fetch(RELEASES_API);
    if (!resp.ok) return null;
    const releases: GhRelease[] = await resp.json();
    const serverRelease = releases.find((r) => r.tag_name.startsWith("server-v"));
    if (!serverRelease) return null;
    return serverRelease.tag_name.replace("server-v", "");
  } catch {
    return null;
  }
}

/** Compare semver strings (v prefix optional). */
export function isNewerServer(remote: string, local: string): boolean {
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

// ── Actions ────────────────────────────────────────────────────────────────

/**
 * Trigger a server self-update.
 *
 * The server will download the new CJS bundle, atomically replace the
 * running file, and exit.  systemd/pm2 should restart it automatically.
 *
 * @param dryRun If true, the server checks but doesn't actually update.
 */
export async function triggerServerUpdate(
  serverUrl: string,
  serverToken: string,
  dryRun = false,
): Promise<ServerUpdateResult> {
  const path = dryRun ? "/api/admin/update?dryRun=1" : "/api/admin/update";
  const resp = await fetch(`${serverUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverToken}`,
    },
  });

  const data = await resp.json().catch(() => ({})) as Record<string, unknown>;

  if (!resp.ok) {
    return {
      updated: false,
      error: (data.error as string) ?? `HTTP ${resp.status}`,
    };
  }

  return {
    updated: data.updated as boolean,
    currentVersion: data.currentVersion as string | undefined,
    remoteVersion: data.remoteVersion as string | undefined,
    reason: data.reason as string | undefined,
    message: data.message as string | undefined,
  };
}
