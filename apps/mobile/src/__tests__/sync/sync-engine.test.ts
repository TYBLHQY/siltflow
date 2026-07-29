/**
 * Tests for SyncEngine camelKeys — snake_case → camelCase conversion.
 *
 * Also tests the composite-PK row_id encoding/decoding logic used by
 * op-log and sync-engine for tables with composite primary keys.
 */

import { describe, it, expect } from "vitest";

// ── camelKeys (from SyncEngine) ───────────────────────────────────────────

function camelKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = value;
  }
  return out;
}

describe("camelKeys", () => {
  it("converts snake_case to camelCase", () => {
    const result = camelKeys({ created_at: "x", updated_at: "y" });
    expect(result).toEqual({ createdAt: "x", updatedAt: "y" });
  });

  it("handles multiple underscores", () => {
    expect(camelKeys({ source_language_code: "en" })).toEqual({
      sourceLanguageCode: "en",
    });
  });

  it("leaves already-camelCase keys alone", () => {
    expect(camelKeys({ id: "1", title: "test" })).toEqual({
      id: "1",
      title: "test",
    });
  });

  it("handles empty object", () => {
    expect(camelKeys({})).toEqual({});
  });

  it("passes through non-string values unchanged", () => {
    const result = camelKeys({ count: 42, active: true, tags: ["a", "b"] });
    expect(result).toEqual({ count: 42, active: true, tags: ["a", "b"] });
  });
});

// ── Composite-PK row_id encoding (from op-log.ts) ────────────────────

const COMPOSITE_PK_TABLES: Record<string, string[]> = {
  annotations: ["id", "document_id"],
  ai_results: ["annotation_id", "document_id"],
  fsrs_cards: ["annotation_id", "document_id"],
  review_logs: ["id", "annotation_id", "document_id"],
};

function encodeCompositeRowId(
  tableName: string,
  pkValues: Record<string, string>,
): string {
  const cols = COMPOSITE_PK_TABLES[tableName];
  if (!cols) return pkValues.id ?? "";
  return cols.map((c) => pkValues[c] ?? "").join("|");
}

function decodeCompositeRowId(
  tableName: string,
  rowId: string,
): Record<string, string> {
  const cols = COMPOSITE_PK_TABLES[tableName];
  if (!cols) return { id: rowId };
  const parts = rowId.split("|");
  const out: Record<string, string> = {};
  cols.forEach((c, i) => { out[c] = parts[i] ?? ""; });
  return out;
}

describe("composite PK row_id encoding", () => {
  it("encodes 2-column PK for annotations", () => {
    const id = encodeCompositeRowId("annotations", {
      id: "ann-1",
      document_id: "doc-5",
    });
    expect(id).toBe("ann-1|doc-5");
  });

  it("encodes 3-column PK for review_logs", () => {
    const id = encodeCompositeRowId("review_logs", {
      id: "log-1",
      annotation_id: "ann-2",
      document_id: "doc-3",
    });
    expect(id).toBe("log-1|ann-2|doc-3");
  });

  it("falls back to plain id for non-composite tables", () => {
    const id = encodeCompositeRowId("documents", { id: "doc-x" });
    expect(id).toBe("doc-x");
  });

  it("decodes annotations row_id back to object", () => {
    const result = decodeCompositeRowId("annotations", "ann-1|doc-5");
    expect(result).toEqual({ id: "ann-1", document_id: "doc-5" });
  });

  it("decodes review_logs row_id back to object", () => {
    const result = decodeCompositeRowId("review_logs", "log-1|ann-2|doc-3");
    expect(result).toEqual({
      id: "log-1",
      annotation_id: "ann-2",
      document_id: "doc-3",
    });
  });

  it("round-trip: encode → decode is identity", () => {
    const pk = { id: "x-1", document_id: "d-1" };
    const encoded = encodeCompositeRowId("annotations", pk);
    const decoded = decodeCompositeRowId("annotations", encoded);
    expect(decoded).toEqual(pk);
  });

  it("returns empty object for unknown table during decode", () => {
    const result = decodeCompositeRowId("documents", "single-id");
    expect(result).toEqual({ id: "single-id" });
  });
});
