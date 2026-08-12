// External deep-link URL parser.
//
// Siltflow registers `siltflow://` as an OS default protocol client so external
// links can open a document by id: `siltflow://open/<documentId>` (UUID v4).
// The URL arrives in the main process via `process.argv` (Windows/Linux) or the
// macOS `open-url` event — it never goes through `protocol.handle`, which only
// serves in-app `siltflow://documents/<id>.pdf` fetches.
//
// This module is intentionally dependency-free (no electron, no drizzle) so the
// parser can be unit-tested under jsdom and carries no path-injection surface:
// the only accepted shape is a literal `siltflow://open/<uuid>`.
const DEEP_LINK_RE =
  /^siltflow:\/\/open\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export interface ParsedDeepLink {
  documentId: string;
}

export function parseDeepLinkUrl(url: string): ParsedDeepLink | null {
  const m = DEEP_LINK_RE.exec(url);
  return m ? { documentId: m[1].toLowerCase() } : null;
}
