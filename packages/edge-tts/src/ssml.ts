import { OUTPUT_FORMAT } from "./constants.js";
import { dateToString, generateConnectId } from "./utils.js";

/**
 * Build the speech.config JSON message sent after connecting.
 * This configures word/sentence boundary events and audio output format.
 */
export function buildSpeechConfig(
  wordBoundary: boolean,
  sentenceBoundary: boolean,
): string {
  const config = {
    context: {
      synthesis: {
        audio: {
          metadataoptions: {
            sentenceBoundaryEnabled: sentenceBoundary,
            wordBoundaryEnabled: wordBoundary,
          },
          outputFormat: OUTPUT_FORMAT,
        },
      },
    },
  };

  // Build the wire format: headers + JSON body
  const timestamp = dateToString(new Date());
  return [
    `X-Timestamp:${timestamp}`,
    "Content-Type:application/json; charset=utf-8",
    "Path:speech.config",
    "",
    JSON.stringify(config),
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
 * Build an SSML document.
 *
 * Note: voice name is the short form (e.g. "en-US-EmmaMultilingualNeural"),
 * NOT the long form ("Microsoft Server Speech Text to Speech Voice...") —
 * the Edge service handles both, but short form is simpler and what the
 * Python library also uses since 2023.
 */
export function buildSsml(
  text: string,
  voice: string,
  rate: string,
  volume: string,
  pitch: string,
): string {
  const escaped = escapeXml(text);
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${voice}'>` +
    `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
    `${escaped}` +
    `</prosody></voice></speak>`
  );
}

/**
 * Build the full SSML request wire format (headers + body).
 */
export function buildSsmlHeaders(ssml: string): string {
  const requestId = generateConnectId();
  const timestamp = dateToString(new Date());
  return [
    `X-RequestId:${requestId}`,
    "Content-Type:application/ssml+xml",
    `X-Timestamp:${timestamp}Z`,
    "Path:ssml",
    "",
    ssml,
  ].join("\r\n");
}
