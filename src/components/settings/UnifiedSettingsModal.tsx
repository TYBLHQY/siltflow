import { useState, useEffect } from "react";
import {
  Bot,
  BrainCircuit,
  TextSelect,
  Volume2,
  Keyboard,
  Info,
} from "lucide-react";
import { IconText } from "@/components/ui/icon-text";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AIConfigContent } from "@/components/settings/AIConfigContent";
import { FSRSConfigContent } from "@/components/settings/FSRSConfigContent";
import { StyleConfigContent } from "@/components/settings/StyleConfigContent";
import { TTSConfigContent } from "@/components/settings/TTSConfigContent";
import { ShortcutsContent } from "@/components/settings/ShortcutsContent";
import { AboutContent } from "@/components/settings/AboutContent";

type SettingsTab = "ai" | "fsrs" | "style" | "tts" | "shortcuts" | "about";

const SETTINGS_TABS: { id: SettingsTab; icon: typeof Bot; label: string }[] = [
  { id: "ai", icon: Bot, label: "AI" },
  { id: "fsrs", icon: BrainCircuit, label: "Spaced Repetition" },
  { id: "style", icon: TextSelect, label: "Style" },
  { id: "tts", icon: Volume2, label: "TTS" },
  { id: "shortcuts", icon: Keyboard, label: "Shortcuts" },
  { id: "about", icon: Info, label: "About" },
];

export function UnifiedSettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("ai");
  const [isCapturingShortcut, setIsCapturingShortcut] = useState(false);

  // Close on Escape key (skip when capturing a shortcut binding)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCapturingShortcut) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, isCapturingShortcut]);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        hideClose
        onEscapeKeyDown={(e) => {
          if (isCapturingShortcut) e.preventDefault();
        }}
        className="flex w-full max-w-3xl h-[calc(100vh-80px)] rounded-lg border bg-ctp-base shadow-xl p-0 gap-0"
      >
        {/* ── Left sidebar ── */}
        <div className="flex w-48 shrink-0 flex-col border-r p-2">
          <nav className="flex flex-col gap-0.5 mt-1">
            {SETTINGS_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-left transition-colors ${
                    tab === t.id
                      ? "bg-ctp-surface0 text-ctp-text font-medium"
                      : "text-ctp-text hover:text-ctp-text hover:bg-ctp-surface0/50"
                  }`}
                  onClick={() => setTab(t.id)}
                >
                  <IconText icon={Icon} size="md">
                    {t.label}
                  </IconText>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Right content ── */}
        <div className="flex flex-1 min-w-0 flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
            {tab === "ai" && <AIConfigContent />}
            {tab === "fsrs" && <FSRSConfigContent />}
            {tab === "style" && <StyleConfigContent />}
            {tab === "tts" && <TTSConfigContent />}
            {tab === "shortcuts" && (
              <ShortcutsContent
                isCapturing={isCapturingShortcut}
                onCapturingChange={setIsCapturingShortcut}
              />
            )}
            {tab === "about" && <AboutContent />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
