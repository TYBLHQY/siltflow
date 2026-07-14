import type { Voice } from "./types.js";
import {
  TRUSTED_CLIENT_TOKEN,
  VOICES_URL,
  SEC_MS_GEC_VERSION,
  WSS_HEADERS,
} from "./constants.js";
import { generateSecMsGec } from "./drm.js";
import { generateMuid } from "./utils.js";

/**
 * Fetch the complete list of available Edge TTS voices.
 *
 * This uses the same API endpoint as Microsoft Edge's browser,
 * with the same authentication (Sec-MS-GEC, muid cookie).
 *
 * Cross-platform: uses global fetch() (Node 18+, RN).
 */
export async function listVoices(): Promise<Voice[]> {
  const { token } = generateSecMsGec(0);
  const muid = generateMuid();

  const url = `${VOICES_URL}?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${token}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

  const response = await fetch(url, {
    headers: {
      ...WSS_HEADERS,
      Cookie: `muid=${muid}`,
    },
  });

  if (!response.ok) {
    // On 403, retry once with clock skew adjustment
    if (response.status === 403) {
      const dateHeader = response.headers.get("Date");
      if (dateHeader) {
        const serverTime = new Date(dateHeader).getTime();
        const skew = serverTime - Date.now();
        const { token: retryToken } = generateSecMsGec(skew);
        const retryUrl = `${VOICES_URL}?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${retryToken}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

        const retryResponse = await fetch(retryUrl, {
          headers: {
            ...WSS_HEADERS,
            Cookie: `muid=${generateMuid()}`,
          },
        });

        if (retryResponse.ok) {
          return (await retryResponse.json()) as Voice[];
        }
      }
    }

    throw new Error(
      `Failed to list voices: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as Voice[];
}
