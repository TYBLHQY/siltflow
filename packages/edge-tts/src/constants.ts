/** Trusted client token obtained from Microsoft Edge's TTS endpoint */
export const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

/** Base domain for the Microsoft Edge speech service */
export const BASE_URL =
  "speech.platform.bing.com/consumer/speech/synthesize/readaloud";

/** WebSocket endpoint for streaming TTS */
export const WSS_URL = `wss://${BASE_URL}/edge/v1`;

/** HTTPS endpoint for listing available voices */
export const VOICES_URL = `https://${BASE_URL}/voices/list`;

export const SEC_MS_GEC_VERSION = "1-143.0.3650.75";

export const DEFAULT_VOICE = "en-US-EmmaMultilingualNeural";

export const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

/** Max SSML text payload size in bytes (UTF-8) */
export const TEXT_CHUNK_MAX_BYTES = 4096;

/** 100-nanosecond ticks per second (Windows FILETIME unit) */
export const TICKS_PER_SECOND = 10_000_000;

/** MP3 audio is 48 kbps constant bitrate */
export const MP3_BITRATE_BPS = 48_000;

/** Seconds between Unix epoch and Windows FILETIME epoch (1601-01-01) */
export const WIN_EPOCH_OFFSET = 11_644_473_600;

/** Browser/Edge user-agent to mimic */
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0";

export const WSS_HEADERS: Record<string, string> = {
  "Pragma": "no-cache",
  "Cache-Control": "no-cache",
  "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
  "Sec-WebSocket-Version": "13",
  "User-Agent": USER_AGENT,
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "en-US,en;q=0.9",
};

export const VOICE_HEADERS: Record<string, string> = {
  "Authority": "speech.platform.bing.com",
  "Sec-CH-UA":
    '" Not;A Brand";v="99", "Microsoft Edge";v="143", "Chromium";v="143"',
  "Sec-CH-UA-Mobile": "?0",
  "Accept": "*/*",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "User-Agent": USER_AGENT,
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "en-US,en;q=0.9",
};
