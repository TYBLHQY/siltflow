/**
 * Tests for loadConfig() — environment variable parsing and validation.
 */

import { describe, it, expect } from "vitest";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("returns defaults when no env vars are set", () => {
    const config = loadConfig({});

    expect(config.port).toBe(3001);
    expect(config.dataDir).toContain(".siltflow-server");
    expect(config.tombstoneRetentionDays).toBe(30);
    expect(config.bootstrapToken).toBeUndefined();
  });

  it("parses PORT from env", () => {
    expect(loadConfig({ PORT: "8080" }).port).toBe(8080);
  });

  it("parses DATA_DIR from env", () => {
    const config = loadConfig({ DATA_DIR: "/tmp/test-db" });
    expect(config.dataDir).toBe("/tmp/test-db");
  });

  it("expands tilde in DATA_DIR", () => {
    const config = loadConfig({ DATA_DIR: "~/mydata" });
    expect(config.dataDir).toContain("mydata");
    // tilde should be expanded to home dir, not left as literal
    expect(config.dataDir).not.toContain("~");
  });

  it("parses TOMBSTONE_RETENTION_DAYS from env", () => {
    expect(loadConfig({ TOMBSTONE_RETENTION_DAYS: "60" }).tombstoneRetentionDays).toBe(60);
  });

  it("reads BOOTSTRAP_TOKEN as bootstrapToken", () => {
    const config = loadConfig({ BOOTSTRAP_TOKEN: "secret123" });
    expect(config.bootstrapToken).toBe("secret123");
  });

  it("falls back to SERVER_TOKEN if BOOTSTRAP_TOKEN is not set", () => {
    const config = loadConfig({ SERVER_TOKEN: "fallback456" });
    expect(config.bootstrapToken).toBe("fallback456");
  });

  it("prefers BOOTSTRAP_TOKEN over SERVER_TOKEN when both are set", () => {
    const config = loadConfig({
      BOOTSTRAP_TOKEN: "primary",
      SERVER_TOKEN: "fallback",
    });
    expect(config.bootstrapToken).toBe("primary");
  });

  it("throws on invalid PORT", () => {
    expect(() => loadConfig({ PORT: "not-a-number" })).toThrow();
    expect(() => loadConfig({ PORT: "0" })).toThrow();
    expect(() => loadConfig({ PORT: "99999" })).toThrow();
  });
});
