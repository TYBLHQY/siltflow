import { create } from "zustand";

interface ToastState {
  message: string | null;
  type: "info" | "error" | "success";
  show: (message: string, type?: "info" | "error" | "success") => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: "info",
  show: (message, type = "info") => {
    set({ message, type });
    setTimeout(() => set({ message: null }), 3000);
  },
}));
