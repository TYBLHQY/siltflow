/**
 * Tests for LocalFileStorage — PDF file persistence on disk.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalFileStorage } from "./local";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("LocalFileStorage", () => {
  let tmpDir: string;
  let storage: LocalFileStorage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "siltflow-test-"));
    storage = new LocalFileStorage(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates the files directory on first upload", async () => {
    const buf = Buffer.from("fake pdf content");
    await storage.upload("doc-1", buf);

    const filesDir = path.join(tmpDir, "files");
    const stat = await fs.stat(filesDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("uploads and downloads a PDF", async () => {
    const buf = Buffer.from("hello world");
    await storage.upload("doc-1", buf);

    const downloaded = await storage.download("doc-1");
    expect(downloaded).not.toBeNull();
    expect(downloaded!.toString()).toBe("hello world");
  });

  it("returns null for missing files", async () => {
    const result = await storage.download("nonexistent");
    expect(result).toBeNull();
  });

  it("reports existence correctly", async () => {
    await storage.upload("doc-a", Buffer.from("x"));
    expect(await storage.exists("doc-a")).toBe(true);
    expect(await storage.exists("doc-b")).toBe(false);
  });

  it("deletes files", async () => {
    await storage.upload("doc-del", Buffer.from("delete me"));
    await storage.delete("doc-del");

    expect(await storage.exists("doc-del")).toBe(false);
    expect(await storage.download("doc-del")).toBeNull();
  });

  it("delete is idempotent for missing files", async () => {
    // Should not throw
    await storage.delete("no-such-file");
  });

  it("handles concurrent uploads to different documents", async () => {
    await Promise.all([
      storage.upload("a", Buffer.from("aaa")),
      storage.upload("b", Buffer.from("bbb")),
      storage.upload("c", Buffer.from("ccc")),
    ]);

    expect((await storage.download("a"))!.toString()).toBe("aaa");
    expect((await storage.download("b"))!.toString()).toBe("bbb");
    expect((await storage.download("c"))!.toString()).toBe("ccc");
  });
});
