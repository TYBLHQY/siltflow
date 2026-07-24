/**
 * Toast store — lightweight, no-Provider-needed toast queue.
 *
 * Each toast auto-dismisses after `durationMs` (default 3000ms).
 * Multiple toasts stack — each slides in above the last.
 */

import { create } from "zustand";

export interface Toast {
  id: string;
  message: string;
  /** "error" | "info" — controls the color scheme */
  type: "error" | "info";
  createdAt: number;
}

interface ToastStore {
  toasts: Toast[];
  pushToast: (message: string, type?: "error" | "info", durationMs?: number) => void;
  dismissToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  pushToast: (message, type = "error", durationMs = 3000) => {
    const id = String(++nextId);
    const toast: Toast = { id, message, type, createdAt: Date.now() };
    set((s) => ({ toasts: [...s.toasts, toast] }));

    setTimeout(() => {
      get().dismissToast(id);
    }, durationMs);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
