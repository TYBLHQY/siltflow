import { dateToString, generateConnectId } from "./utils.js";

/**
 * Convert a short voice name (e.g. "en-US-EmmaMultilingualNeural") to
 * the long form used by Microsoft Edge:
 * "Microsoft Server Speech Text to Speech Voice (en-US, EmmaMultilingualNeural)"
 *
 * Matches Python edge-tts TTSConfig.__post_init__()
 */
export function toLongVoiceName(shortName: string): string {
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

/**
 * Build the speech.config JSON message sent after connecting.
 * This configures word/sentence boundary events and audio output format.
 *
 * NOTE: booleans are sent as "true"/"false" strings (matching Python
 * edge-tts behavior).
 */
export function buildSpeechConfig(
  wordBoundary: boolean,
  _sentenceBoundary: boolean,
): string {
  const wd = wordBoundary ? "true" : "false";
  const sq = wordBoundary ? "false" : "true"; // inverted — only one active at a time
  // NOTE: booleans are string literals, matching Python edge-tts behavior
  const timestamp = dateToString();
  return [
    `X-Timestamp:${timestamp}`,
    "Content-Type:application/json; charset=utf-8",
    "Path:speech.config",
    "",
    `{"context":{"synthesis":{"audio":{"metadataoptions":{` +
    `"sentenceBoundaryEnabled":"${sq}","wordBoundaryEnabled":"${wd}"` +
    `},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`,
  ].join("\r\n");
}

/**
 * XML-escape text for embedding in SSML.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Remove incompatible characters (control chars) that Edge TTS rejects.
 * Matches Python remove_incompatible_characters().
 */
function removeIncompatibleCharacters(text: string): string {
  const chars: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if ((0 <= code && code <= 8) || (11 <= code && code <= 12) || (14 <= code && code <= 31)) {
      chars.push(" ");
    } else {
      chars.push(text[i]);
    }
  }
  return chars.join("");
}

/**
 * Build an SSML document.
 *
 * Matches Python edge-tts mkssml() — voice name is the LONG form,
 * text is XML-escaped and incompatible characters removed.
 */
export function buildSsml(
  text: string,
  voice: string,
  rate: string,
  volume: string,
  pitch: string,
): string {
  const cleaned = removeIncompatibleCharacters(text);
  const escaped = escapeXml(cleaned);
  const longVoice = toLongVoiceName(voice);
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${longVoice}'>` +
    `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
    `${escaped}` +
    `</prosody></voice></speak>`
  );
}

/**
 * Build the full SSML request wire format (headers + body).
 * Matches Python ssml_headers_plus_data().
 */
export function buildSsmlHeaders(ssml: string): string {
  const requestId = generateConnectId();
  const timestamp = dateToString();
  return [
    `X-RequestId:${requestId}`,
    "Content-Type:application/ssml+xml",
    `X-Timestamp:${timestamp}Z`, // trailing Z is a Microsoft Edge bug, matched from Python
    "Path:ssml",
    "",
    ssml,
  ].join("\r\n");
}
