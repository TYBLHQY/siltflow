import { describe, it, expect } from "vitest";
import { parseDeepLinkUrl } from "./deep-link";

const DOC_ID = "3f2c1a7e-9b8d-4a1f-8c3e-2d5b0a9e6f77";

describe("parseDeepLinkUrl", () => {
  it("parses a valid lowercase UUID", () => {
    expect(parseDeepLinkUrl(`siltflow://open/${DOC_ID}`)).toEqual({
      documentId: DOC_ID,
    });
  });

  it("parses an uppercase UUID and normalizes it to lowercase", () => {
    expect(parseDeepLinkUrl(`siltflow://open/${DOC_ID.toUpperCase()}`)).toEqual(
      { documentId: DOC_ID },
    );
  });

  it("rejects the internal file-serving URL documents/<id>.pdf", () => {
    expect(parseDeepLinkUrl(`siltflow://documents/${DOC_ID}.pdf`)).toBeNull();
  });

  it("rejects a malformed UUID", () => {
    expect(parseDeepLinkUrl("siltflow://open/not-a-uuid")).toBeNull();
    expect(
      parseDeepLinkUrl(`siltflow://open/${DOC_ID.slice(0, -1)}`),
    ).toBeNull();
  });

  it("rejects a missing open/ prefix", () => {
    expect(parseDeepLinkUrl(`siltflow://${DOC_ID}`)).toBeNull();
  });

  it("rejects a non-siltflow scheme", () => {
    expect(parseDeepLinkUrl(`https://open/${DOC_ID}`)).toBeNull();
    expect(parseDeepLinkUrl(`siltflow2://open/${DOC_ID}`)).toBeNull();
  });

  it("rejects trailing/leading noise", () => {
    expect(parseDeepLinkUrl(`siltflow://open/${DOC_ID}/`)).toBeNull();
    expect(parseDeepLinkUrl(` x siltflow://open/${DOC_ID}`)).toBeNull();
  });
});
