import { useToastStore } from "@/stores/toast.store";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useEffect, useState, useRef } from "react";

export function Toast() {
  const message = useToastStore((s) => s.message);
  const type = useToastStore((s) => s.type);
  const [displayed, setDisplayed] = useState<{
    message: string;
    type: string;
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (message) {
      setDisplayed({ message, type });
      // Trigger enter animation on next frame
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      );
    } else if (displayed) {
      // Start exit animation
      setVisible(false);
      // Remove DOM after animation completes
      timerRef.current = setTimeout(() => setDisplayed(null), 300);
    }
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!displayed) return null;

  const Icon =
    displayed.type === "info"
      ? Info
      : displayed.type === "success"
        ? CheckCircle2
        : AlertCircle;

  const darkColorMap = {
    info: "border-ctp-blue-600 bg-ctp-blue-950/90 text-ctp-base backdrop-blur-sm",
    success: "border-ctp-green-600 bg-ctp-green-950/90 text-ctp-base backdrop-blur-sm",
    error: "border-ctp-red-600 bg-ctp-red-950/90 text-ctp-base backdrop-blur-sm",
  };

  return (
    <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 pointer-events-none">
      <div
        className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 shadow-lg text-sm transition-all duration-300 ease-out ${
          visible
            ? "translate-y-0 opacity-100 scale-100"
            : "-translate-y-4 opacity-0 scale-95"
        } ${darkColorMap[displayed.type as keyof typeof darkColorMap]}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{displayed.message}</span>
      </div>
    </div>
  );
}
