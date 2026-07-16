import { useState, useEffect, useMemo } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShortcutsStore } from "@/stores/shortcuts.store";
import { formatShortcut } from "@/lib/keyboard-keys";

export function ShortcutsContent() {
  const shortcuts = useShortcutsStore((s) => s.shortcuts);
  const setShortcutKeys = useShortcutsStore((s) => s.setShortcutKeys);
  const resetShortcut = useShortcutsStore((s) => s.resetShortcut);
  const resetAllShortcuts = useShortcutsStore((s) => s.resetAllShortcuts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Group shortcuts by context
  const groups = useMemo(() => {
    const map: Record<string, typeof shortcuts> = {};
    for (const s of shortcuts) {
      const context = s.context;
      if (!map[context]) map[context] = [];
      map[context].push(s);
    }
    return map;
  }, [shortcuts]);

  const contextLabels: Record<string, string> = {
    global: "Global (app-wide)",
    "pdf-open": "PDF Viewer",
    "annotations-tab": "Annotations Tab",
    "learning-mode": "Learning Mode",
  };

  const handleStartCapture = (actionId: string) => {
    setEditingId(actionId);
    setCapturing(true);
  };

  useEffect(() => {
    if (!capturing || !editingId) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setEditingId(null);
        setCapturing(false);
        return;
      }

      // Build shortcut string from the event
      const parts: string[] = [];
      if (e.altKey) parts.push("alt");
      if (e.ctrlKey) parts.push("ctrl");
      if (e.shiftKey) parts.push("shift");
      if (e.metaKey) parts.push("meta");

      // Handle special keys
      const key = e.key.toLowerCase();
      if (["alt", "ctrl", "shift", "meta"].includes(key)) return; // modifier-only

      if (key === " ") {
        parts.push("space");
      } else if (key === ",") {
        parts.push("comma");
      } else if (key === "[") {
        parts.push("[");
      } else if (key === "]") {
        parts.push("]");
      } else if (e.code?.startsWith("Numpad") && /^[0-9]$/.test(key)) {
        parts.push(`num${key}`); // num1, num2, etc.
      } else if (/^[a-z0-9]$/.test(key)) {
        parts.push(key);
      } else if (key.startsWith("arrow")) {
        parts.push(key);
      } else if (key === "enter") {
        parts.push("enter");
      } else if (key === "escape") {
        return; // handled above
      } else if (key === "tab") {
        parts.push("tab");
      } else if (key === "delete" || key === "backspace") {
        parts.push("delete");
      } else if (key === "home") {
        parts.push("home");
      } else if (key === "end") {
        parts.push("end");
      } else {
        parts.push(key);
      }

      if (parts.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setShortcutKeys(editingId as any, parts.join("+"));
      }
      setEditingId(null);
      setCapturing(false);
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [capturing, editingId, setShortcutKeys]);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Keyboard className="h-5 w-5" />
        <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
      </div>

      {capturing && editingId && (
        <div className="mb-3 rounded-md border border-ctp-mauve bg-ctp-mauve/5 px-3 py-2 text-xs text-ctp-mauve">
          Press the key combination for this shortcut (or Escape to cancel)...
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(groups).map(([context, items]) => {
          const visible = items.filter((s) => !s.locked);
          if (visible.length === 0) return null;
          return (
            <div key={context}>
              <h3 className="text-xs font-medium text-ctp-overlay0 mb-1 uppercase tracking-wider">
                {contextLabels[context] ?? context}
              </h3>
              <div className="space-y-1">
                {visible.map((s) => (
                  <div
                    key={s.actionId}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-ctp-surface0 transition-colors text-xs gap-2"
                  >
                    <span className="text-ctp-text min-w-0 flex-1">
                      {s.label}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {editingId === s.actionId ? (
                        <span className="inline-flex items-center rounded border border-ctp-mauve bg-ctp-mauve/10 px-2 py-0.5 text-xs font-mono">
                          (listening...)
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-ctp-surface0 px-2 py-0.5 text-xs font-mono">
                          {formatShortcut(s.keys)}
                        </span>
                      )}
                      <button
                        className="text-xs text-ctp-overlay0 hover:text-ctp-text ml-1"
                        onClick={() => handleStartCapture(s.actionId)}
                        title="Change shortcut"
                      >
                        ✎
                      </button>
                      {s.keys !== s.defaultKeys && (
                        <button
                          className="text-xs text-ctp-overlay0 hover:text-ctp-red"
                          onClick={() => resetShortcut(s.actionId)}
                          title="Reset to default"
                        >
                          ↺
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-ctp-red"
          onClick={resetAllShortcuts}
        >
          Reset all to defaults
        </Button>
      </div>
    </>
  );
}
