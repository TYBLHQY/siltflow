import { sha256 } from "js-sha256";
import {
  TRUSTED_CLIENT_TOKEN,
  WIN_EPOCH_OFFSET,
  TICKS_PER_SECOND,
} from "./constants.js";
import { generateMuid, dateToString } from "./utils.js";

/**
 * Generate the Sec-MS-GEC authentication token.
 *
 * Algorithm (from Python edge-tts):
 * 1. Get Unix timestamp + clock skew adjustment
 * 2. Convert to Windows FILETIME (1601-01-01 epoch, 100-ns ticks)
 * 3. Round down to nearest 300 seconds (5 minutes)
 * 4. SHA-256(`${rounded_ticks}${TRUSTED_CLIENT_TOKEN}`)
 * 5. Return uppercase hex + date string
 *
 * Must use BigInt — Windows FILETIME for current dates exceeds
 * JavaScript's 53-bit integer precision (~9e15 vs ~1.3e17).
 */
export function generateSecMsGec(clockSkewMs: number = 0): {
  token: string;
  date: string;
} {
  const now = Date.now() + clockSkewMs;
  const date = new Date(now);

  // Unix timestamp in seconds
  const unixSeconds = Math.floor(now / 1000);

  // Convert to Windows FILETIME (100-ns ticks since 1601-01-01)
  const winEpoch = BigInt(WIN_EPOCH_OFFSET) * BigInt(TICKS_PER_SECOND);
  const unixTicks = BigInt(unixSeconds) * BigInt(TICKS_PER_SECOND);
  const filetime = unixTicks + winEpoch;

  // Round down to nearest 300 seconds (5 min)
  // 300 seconds = 3_000_000_000 100-ns ticks
  const roundInterval = 3_000_000_000n;
  const rounded = (filetime / roundInterval) * roundInterval;

  // Hash: `${rounded_ticks}${TRUSTED_CLIENT_TOKEN}`
  const hashInput = rounded.toString() + TRUSTED_CLIENT_TOKEN;
  const token = sha256(hashInput).toUpperCase();

  return { token, date: dateToString(date) };
}

/**
 * Tracks clock skew between client and server.
 * On 403 responses, the server's Date header tells us the real time,
 * and we adjust subsequent tokens.
 */
export class ClockSkewManager {
  private skewMs: number = 0;

  /** Record clock skew from the server's Date header. */
  recordServerDate(dateHeader: string): void {
    const serverTime = new Date(dateHeader).getTime();
    if (!isNaN(serverTime)) {
      this.skewMs = serverTime - Date.now();
    }
  }

  /** Get a Sec-MS-GEC token with current clock skew applied. */
  getAdjustedToken(): { token: string; date: string } {
    return generateSecMsGec(this.skewMs);
  }

  /** Get the current skew in ms. */
  getSkewMs(): number {
    return this.skewMs;
  }

  reset(): void {
    this.skewMs = 0;
  }
}

/**
 * Add a muid cookie header to an existing headers object.
 * The muid is a random 32-character uppercase hex string.
 */
export function headersWithMuid(
  headers: Record<string, string>,
  muid?: string,
): Record<string, string> {
  const id = muid ?? generateMuid();
  return {
    ...headers,
    Cookie: `muid=${id}`,
  };
}
