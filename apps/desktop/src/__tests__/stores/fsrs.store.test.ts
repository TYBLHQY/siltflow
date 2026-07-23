import { describe, it, expect } from "vitest";
import { getFSRSEngine } from "@/stores/fsrs.store";

// Mock the window.siltflow API to avoid Electron IPC errors
const mockSiltflow = {
  vaultConfigSet: () => {},
  vaultConfigGet: () => Promise.resolve({}),
};
(globalThis as Record<string, unknown>).window = {
  siltflow: mockSiltflow,
} as unknown as Window & typeof globalThis;

describe("getFSRSEngine", () => {
  it("should return an fsrs engine instance", () => {
    const engine = getFSRSEngine();
    expect(engine).toBeDefined();
    expect(typeof engine.next).toBe("function");
  });
});
