/**
 * Tests for toast store — pure Zustand store with no native dependencies.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useToastStore } from "@/stores/toast.store";

describe("useToastStore", () => {
  beforeEach(() => {
    // Reset store state between tests
    useToastStore.setState({ toasts: [] });
  });

  it("starts with empty toasts", () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("pushToast adds a toast with auto-incrementing id", () => {
    const store = useToastStore.getState();

    store.pushToast("hello");
    store.pushToast("world");

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(2);
    expect(toasts[0].message).toBe("hello");
    expect(toasts[1].message).toBe("world");
    expect(toasts[0].type).toBe("error"); // default
    expect(toasts[1].type).toBe("error");
  });

  it("pushToast accepts a custom type", () => {
    useToastStore.getState().pushToast("info message", "info");
    const { toasts } = useToastStore.getState();
    expect(toasts[0].type).toBe("info");
    expect(toasts[0].message).toBe("info message");
  });

  it("dismissToast removes the toast by id", () => {
    const store = useToastStore.getState();
    store.pushToast("first");
    store.pushToast("second");

    const afterPush = useToastStore.getState();
    const firstId = afterPush.toasts[0].id;

    useToastStore.getState().dismissToast(firstId);
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("second");
  });

  it("dismissToast is a no-op for unknown ids", () => {
    useToastStore.getState().pushToast("only");
    useToastStore.getState().dismissToast("nonexistent");
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("each toast has a createdAt timestamp", () => {
    const before = Date.now();
    useToastStore.getState().pushToast("test");
    const after = Date.now();
    const { createdAt } = useToastStore.getState().toasts[0];
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
  });
});
