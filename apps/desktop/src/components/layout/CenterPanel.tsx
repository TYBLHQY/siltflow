import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Maximize,
  Minimize,
  Settings,
  Bot,
  X,
  BrainCircuit,
  TextSelect,
  Search,
  Volume2,
  Loader2,
  Keyboard,
  PenLine,
  MousePointer2,
  Info,
  ExternalLink,
  Download,
  BarChart3,
} from "lucide-react";
import { IconText } from "@/components/ui/icon-text";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PdfViewer } from "@/components/document/PdfViewer";
import { usePdfViewerStore } from "@/stores/pdf-viewer.store";
import { SyncButton } from "@/components/SyncButton";
import {
  useAnnotationStore,
  type AnnotationEmbedData,
} from "@/stores/annotation.store";
import { useAIStore, BUILTIN_PROVIDERS } from "@/stores/ai.store";
import { useFSRSStore } from "@/stores/fsrs.store";
import { useStyleStore } from "@/stores/style.store";
import {
  useTTSStore,
  MIMO_PRESET_VOICES,
  MIMO_MODELS,
} from "@/stores/tts.store";
import { useShortcutsStore } from "@/stores/shortcuts.store";
import { useThemeStore } from "@/stores/theme.store";
import { formatShortcut } from "@siltflow/shared/utils";
import { useAppSettingsStore } from "@/stores/app.store";
import { useDocumentStore } from "@/stores/document.store";
import { useShortcut } from "@/hooks/useShortcut";
import { StatsDashboard } from "@/components/stats/StatsDashboard";

// ---------------------------------------------------------------------------
// Page navigation — jump to page (only shown when a PDF is open)
// ---------------------------------------------------------------------------
function PageNav() {
  const goToPage = usePdfViewerStore((s) => s.goToPage);
  const currentPage = usePdfViewerStore((s) => s.currentPage);
  const pdfDocument = usePdfViewerStore((s) => s.pdfDocument);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  const totalPages = pdfDocument?.numPages ?? 0;

  const handleJump = useCallback(() => {
    const n = parseInt(input, 10);
    if (isNaN(n) || n < 1 || n > totalPages || !goToPage) {
      setInput("");
      return;
    }
    goToPage(n);
    setInput("");
  }, [input, totalPages, goToPage]);

  if (!pdfDocument || totalPages === 0) return null;

  return (
    <div className="flex items-center h-full shrink-0">
      <div className="flex items-center gap-0.5 rounded-md border border-border/50 bg-muted/40 px-2 text-xs text-foreground">
        {focused ? (
          <input
            className="w-10 bg-transparent py-0.5 text-center outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJump();
              if (e.key === "Escape") {
                setInput("");
                setFocused(false);
              }
            }}
            onBlur={() => {
              setFocused(false);
              setInput("");
            }}
            autoFocus
            placeholder={String(currentPage)}
          />
        ) : (
          <button
            className="rounded px-1 py-0.5 hover:bg-accent transition-colors"
            onClick={() => setFocused(true)}
            title="Jump to page"
          >
            {currentPage}
          </button>
        )}
        <span className="opacity-60">/ {totalPages}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick-add toggle button — placed left of fit-width in the toolbar.
// ---------------------------------------------------------------------------
function QuickAddToggle() {
  const quickAddEnabled = usePdfViewerStore((s) => s.quickAddEnabled);
  const setQuickAddEnabled = usePdfViewerStore((s) => s.setQuickAddEnabled);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-6 w-6 ${quickAddEnabled ? "bg-accent" : ""}`}
      onClick={() => setQuickAddEnabled(!quickAddEnabled)}
      title={
        quickAddEnabled
          ? "Quick-add mode (selection auto-annotates)"
          : "Manual mode (selection shows add button)"
      }
    >
      {quickAddEnabled ? (
        <PenLine className="h-4 w-4" />
      ) : (
        <MousePointer2 className="h-4 w-4" />
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Fit-to-width toggle button.  Uses setViewerScale directly so it can pass
// "page-width" / "auto" to viewer.currentScaleValue without going through the
// numeric pdfScaleValue prop (which must stay a number for proximity-check).
// ---------------------------------------------------------------------------
function FitWidthButton() {
  const fitWidth = usePdfViewerStore((s) => s.fitWidth);
  const setFitWidth = usePdfViewerStore((s) => s.setFitWidth);
  const setViewerScale = usePdfViewerStore((s) => s.setViewerScale);
  const setPdfScale = usePdfViewerStore((s) => s.setPdfScale);

  const toggle = useCallback(() => {
    if (!setViewerScale) return;
    if (fitWidth) {
      setViewerScale("auto");
      setFitWidth(false);
      setPdfScale(0); // back to auto mode
    } else {
      setViewerScale("page-width");
      setFitWidth(true);
    }
  }, [fitWidth, setViewerScale, setFitWidth, setPdfScale]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-6 w-6 ${fitWidth ? "bg-accent" : ""}`}
      onClick={toggle}
      title={fitWidth ? "Auto zoom" : "Fit to width"}
    >
      {fitWidth ? (
        <Minimize className="h-4 w-4" />
      ) : (
        <Maximize className="h-4 w-4" />
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Unified Settings modal — left sidebar navigation, right panel content
// ---------------------------------------------------------------------------

type SettingsTab = "ai" | "fsrs" | "style" | "tts" | "shortcuts" | "about";

const SETTINGS_TABS: { id: SettingsTab; icon: typeof Bot; label: string }[] = [
  { id: "ai", icon: Bot, label: "AI" },
  { id: "fsrs", icon: BrainCircuit, label: "Spaced Repetition" },
  { id: "style", icon: TextSelect, label: "Style" },
  { id: "tts", icon: Volume2, label: "TTS" },
  { id: "shortcuts", icon: Keyboard, label: "Shortcuts" },
  { id: "about", icon: Info, label: "About" },
];

// ---------------------------------------------------------------------------
// Settings button — opens unified settings dialog
// ---------------------------------------------------------------------------
function SettingsButton() {
  const [open, setOpen] = useState(false);

  // Listen for the shortcut-triggered settings toggle event
  useEffect(() => {
    const handler = () => setOpen((c) => !c);
    window.addEventListener("siltflow:toggle-settings", handler);
    return () =>
      window.removeEventListener("siltflow:toggle-settings", handler);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setOpen(true)}
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
      <UnifiedSettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function UnifiedSettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("ai");

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        hideClose
        className="flex w-full max-w-3xl h-[calc(100vh-80px)] rounded-lg border bg-background shadow-xl p-0 gap-0"
      >
        {/* ── Left sidebar ── */}
        <div className="flex w-48 shrink-0 flex-col border-r p-2">
          <div className="flex items-center gap-2 px-2 py-3">
            <IconText icon={Settings} size="md">
              <span className="text-xs font-semibold">Settings</span>
            </IconText>
          </div>
          <nav className="flex flex-col gap-0.5 mt-1">
            {SETTINGS_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-left transition-colors ${
                    tab === t.id
                      ? "bg-accent text-foreground font-medium"
                      : "text-foreground hover:text-foreground hover:bg-accent/50"
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
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <div />
            <button
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
            {tab === "ai" && <AIConfigContent />}
            {tab === "fsrs" && <FSRSConfigContent />}
            {tab === "style" && <StyleConfigContent />}
            {tab === "tts" && <TTSConfigContent />}
            {tab === "shortcuts" && <ShortcutsContent />}
            {tab === "about" && <AboutContent />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AI Config content (inside unified settings)
// ---------------------------------------------------------------------------
function AIConfigContent() {
  const profiles = useAIStore((s) => s.profiles);
  const addProfile = useAIStore((s) => s.addProfile);
  const removeProfile = useAIStore((s) => s.removeProfile);
  const updateProfile = useAIStore((s) => s.updateProfile);
  const setActiveProfile = useAIStore((s) => s.setActiveProfile);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // All built-in providers not yet configured
  const usedKeys = new Set(profiles.map((p) => p.providerKey));
  const availableProviders = BUILTIN_PROVIDERS.filter(
    (p: { key: string; editable?: boolean }) =>
      !usedKeys.has(p.key) || p.editable,
  );

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-5 w-5" />
        <h2 className="text-base font-semibold">AI Providers</h2>
      </div>

      {/* Profile list */}
      <div className="space-y-2">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`rounded-md border p-3 transition-colors ${
              profile.active ? "border-primary" : ""
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {renameId === profile.id ? (
                  <input
                    className="w-40 rounded border bg-background px-2 py-0.5 text-sm"
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => {
                      if (renameValue.trim()) {
                        updateProfile(profile.id, { name: renameValue.trim() });
                      }
                      setRenameId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (renameValue.trim()) {
                          updateProfile(profile.id, {
                            name: renameValue.trim(),
                          });
                        }
                        setRenameId(null);
                      }
                      if (e.key === "Escape") setRenameId(null);
                    }}
                  />
                ) : (
                  <span className="text-sm font-medium truncate">
                    {profile.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground uppercase">
                  {profile.providerKey}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!profile.active && (
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => setActiveProfile(profile.id)}
                  >
                    Activate
                  </button>
                )}
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setRenameId(profile.id);
                    setRenameValue(profile.name);
                  }}
                >
                  Rename
                </button>
                <button
                  className="text-xs text-destructive hover:underline"
                  onClick={() => removeProfile(profile.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Config fields */}
            {editingId === profile.id ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-0.5">
                      Base URL
                    </label>
                    <input
                      className="w-full rounded border bg-background px-2 py-1 text-xs"
                      value={profile.baseUrl}
                      onChange={(e) =>
                        updateProfile(profile.id, { baseUrl: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-0.5">
                      Model
                    </label>
                    <input
                      className="w-full rounded border bg-background px-2 py-1 text-xs"
                      value={profile.model}
                      onChange={(e) =>
                        updateProfile(profile.id, { model: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="mb-2">
                  <label className="block text-xs text-muted-foreground mb-0.5">
                    API Key
                  </label>
                  <input
                    type="password"
                    className="w-full rounded border bg-background px-2 py-1 text-xs"
                    value={profile.apiKey}
                    onChange={(e) =>
                      updateProfile(profile.id, { apiKey: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-0.5">
                      Temperature
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      className="w-full"
                      value={profile.temperature}
                      onChange={(e) =>
                        updateProfile(profile.id, {
                          temperature: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-0.5">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded border bg-background px-2 py-1 text-xs"
                      value={profile.maxTokens}
                      onChange={(e) =>
                        updateProfile(profile.id, {
                          maxTokens: parseInt(e.target.value, 10) || 512,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-0.5">
                      Top P
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      className="w-full"
                      value={profile.topP}
                      onChange={(e) =>
                        updateProfile(profile.id, {
                          topP: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="truncate">{profile.baseUrl}</span>
                <span>·</span>
                <span>{profile.model}</span>
              </div>
            )}

            {/* Toggle config edit */}
            <button
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() =>
                setEditingId(editingId === profile.id ? null : profile.id)
              }
            >
              {editingId === profile.id ? "Collapse" : "Edit params"}
            </button>
          </div>
        ))}
      </div>

      {/* Add provider */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-primary hover:underline">
          + Add provider
        </summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {availableProviders.map(
            (provider: { key: string; label: string }) => (
              <button
                key={provider.key}
                className="rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                onClick={() => {
                  addProfile(provider.key);
                }}
              >
                {provider.label}
              </button>
            ),
          )}
        </div>
      </details>

      {/* Default target language */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center gap-2 mb-1">
          <label className="text-xs font-medium">Default target language</label>
        </div>
        <select
          className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
          value={useAIStore.getState().defaultTargetLang}
          onChange={(e) =>
            useAIStore.getState().setDefaultTargetLang(e.target.value)
          }
        >
          <option value="zh">中文</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="es">Español</option>
          <option value="ko">한국어</option>
          <option value="ru">Русский</option>
        </select>
        <p className="text-xs text-muted-foreground mt-0.5">
          Used for AI translation when no per-document override is set.
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// FSRS Config modal
// ---------------------------------------------------------------------------
function FSRSConfigContent() {
  const params = useFSRSStore((s) => s.params);
  const updateParam = useFSRSStore((s) => s.updateParam);
  const resetParams = useFSRSStore((s) => s.resetParams);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <BrainCircuit className="h-5 w-5" />
        <h2 className="text-base font-semibold">Spaced Repetition (FSRS)</h2>
      </div>

      <div className="space-y-4">
        {/* Request retention */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Retention rate ({Math.round(params.request_retention * 100)}%)
          </label>
          <input
            type="range"
            min="0.7"
            max="0.97"
            step="0.01"
            className="w-full"
            value={params.request_retention}
            onChange={(e) =>
              updateParam("request_retention", parseFloat(e.target.value))
            }
          />
          <p className="text-xs text-muted-foreground mt-0.5">
            Higher = more reviews, better retention. Default: 85%
          </p>
        </div>

        {/* Maximum interval */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Maximum interval (days: {params.maximum_interval})
          </label>
          <input
            type="range"
            min="30"
            max="3650"
            step="30"
            className="w-full"
            value={params.maximum_interval}
            onChange={(e) =>
              updateParam("maximum_interval", parseInt(e.target.value, 10))
            }
          />
          <p className="text-xs text-muted-foreground mt-0.5">
            Max days between reviews. Default: 365
          </p>
        </div>

        {/* Fuzz */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enable_fuzz"
            className="rounded"
            checked={params.enable_fuzz}
            onChange={(e) => updateParam("enable_fuzz", e.target.checked)}
          />
          <label htmlFor="enable_fuzz" className="text-xs">
            Enable fuzz (adds jitter to intervals for natural spacing)
          </label>
        </div>

        {/* Short term steps */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enable_short_term"
            className="rounded"
            checked={params.enable_short_term}
            onChange={(e) => updateParam("enable_short_term", e.target.checked)}
          />
          <label htmlFor="enable_short_term" className="text-xs">
            Enable short-term (re)learning steps
          </label>
        </div>

        {/* Learning steps (shown when enable_short_term) */}
        {params.enable_short_term && (
          <div>
            <label className="block text-xs font-medium mb-1">
              Learning steps
            </label>
            <div className="flex gap-2">
              {[0, 1].map((idx) => {
                const raw = (params.learning_steps as string[])[idx] ?? "1m";
                const val = parseInt(raw.replace(/[^0-9]/g, ""), 10) || 1;
                return (
                  <div key={idx} className="flex-1 flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                      value={val}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10) || 1;
                        const arr = [...(params.learning_steps as string[])];
                        arr[idx] = `${n}m`;
                        updateParam("learning_steps" as const, arr as any);
                      }}
                    />
                    <span className="text-xs text-muted-foreground shrink-0">
                      m
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Relearning steps */}
        {params.enable_short_term && (
          <div>
            <label className="block text-xs font-medium mb-1">
              Relearning steps
            </label>
            <div className="flex gap-2">
              {[0].map((idx) => {
                const raw = (params.relearning_steps as string[])[idx] ?? "10m";
                const val = parseInt(raw.replace(/[^0-9]/g, ""), 10) || 10;
                return (
                  <div key={idx} className="flex-1 flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                      value={val}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10) || 10;
                        const arr = [`${n}m`];
                        updateParam("relearning_steps" as const, arr as any);
                      }}
                    />
                    <span className="text-xs text-muted-foreground shrink-0">
                      m
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-destructive"
          onClick={resetParams}
        >
          Reset to defaults
        </Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Style Config modal (paragraph font & font size)
// ---------------------------------------------------------------------------
// Use the Query List API to enumerate all installed fonts on the system.

function useSystemFonts(): string[] {
  const [fonts, setFonts] = useState<string[]>([]);

  useEffect(() => {
    if (!("queryLocalFonts" in self)) {
      // Fallback: return a minimal list for browsers without the Font Access API
      setFonts([
        "system-ui, sans-serif",
        "Inter, system-ui, sans-serif",
        "Georgia, 'Times New Roman', serif",
        "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        "'Fira Code', monospace",
      ]);
      return;
    }
    let cancelled = false;
    (self as any)
      .queryLocalFonts()
      .then((items: any[]) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const list: string[] = [];
        for (const item of items) {
          const name = item.family as string;
          if (!seen.has(name)) {
            seen.add(name);
            list.push(name);
          }
        }
        list.sort((a, b) => a.localeCompare(b));
        setFonts(list);
      })
      .catch(() => {
        // API not allowed or unavailable
        if (!cancelled)
          setFonts([
            "Inter, system-ui, sans-serif",
            "Georgia, serif",
            "monospace",
          ]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return fonts;
}

function StyleConfigContent() {
  const style = useStyleStore((s) => s.style);
  const setFontFamilies = useStyleStore((s) => s.setFontFamilies);
  const addFontFamily = useStyleStore((s) => s.addFontFamily);
  const removeFontFamily = useStyleStore((s) => s.removeFontFamily);
  const setFontSize = useStyleStore((s) => s.setFontSize);
  const setGlobalFontSize = useStyleStore((s) => s.setGlobalFontSize);
  const setPdfScrollbar = useStyleStore((s) => s.setPdfScrollbar);
  const setLearnPanelHeight = useStyleStore((s) => s.setLearnPanelHeight);
  const setSystemFontFamilies = useStyleStore((s) => s.setSystemFontFamilies);
  const addSystemFontFamily = useStyleStore((s) => s.addSystemFontFamily);
  const removeSystemFontFamily = useStyleStore((s) => s.removeSystemFontFamily);
  const reset = useStyleStore((s) => s.reset);
  const themeConfig = useThemeStore((s) => s.config);
  const setLightTheme = useThemeStore((s) => s.setLightTheme);
  const setDarkTheme = useThemeStore((s) => s.setDarkTheme);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const setPdfDarkInvert = useThemeStore((s) => s.setPdfDarkInvert);
  const systemFonts = useSystemFonts();
  const [search, setSearch] = useState("");
  const [showFontList, setShowFontList] = useState(false);
  const [showSystemFontList, setShowSystemFontList] = useState(false);
  const [search2, setSearch2] = useState("");

  const filtered = search
    ? systemFonts.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    : systemFonts;

  const filtered2 = search2
    ? systemFonts.filter((f) => f.toLowerCase().includes(search2.toLowerCase()))
    : systemFonts;

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <TextSelect className="h-5 w-5" />
        <h2 className="text-base font-semibold">Paragraph Style</h2>
      </div>

      <div className="space-y-5">
        {/* Font family — ordered list */}
        <div>
          <label className="block text-xs font-medium mb-1.5">
            Font Family
          </label>

          {/* Current font list */}
          <div className="space-y-1 mb-2">
            {style.fontFamilies.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded-md border bg-background px-2 py-1"
              >
                <span className="text-xs text-muted-foreground w-4 shrink-0">
                  {i + 1}.
                </span>
                <span
                  className="flex-1 truncate text-xs"
                  style={{ fontFamily: f }}
                >
                  {f}
                </span>
                <button
                  className="text-xs text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-30"
                  onClick={() => removeFontFamily(i)}
                  disabled={style.fontFamilies.length <= 1}
                >
                  ✕
                </button>
                {i > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => {
                      const arr = [...style.fontFamilies];
                      [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                      setFontFamilies(arr);
                    }}
                  >
                    ↑
                  </button>
                )}
                {i < style.fontFamilies.length - 1 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => {
                      const arr = [...style.fontFamilies];
                      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                      setFontFamilies(arr);
                    }}
                  >
                    ↓
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add font — button to open, search + list when open */}
          {showFontList ? (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="w-full rounded-md border bg-background pl-7 pr-2 py-1.5 text-xs"
                  placeholder="Search fonts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {filtered.map((font) => {
                  const isAdded = style.fontFamilies.includes(font);
                  return (
                    <button
                      key={font}
                      className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors ${
                        isAdded
                          ? "text-muted-foreground cursor-default"
                          : "hover:bg-accent text-foreground"
                      }`}
                      onClick={() => {
                        if (!isAdded) {
                          addFontFamily(font);
                          setShowFontList(false);
                        }
                        setSearch("");
                      }}
                    >
                      <span
                        className="flex-1 truncate"
                        style={{ fontFamily: font }}
                      >
                        {font}
                      </span>
                      {isAdded && (
                        <span className="text-primary shrink-0">✓</span>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="px-2.5 py-3 text-xs text-muted-foreground text-center">
                    No fonts match &quot;{search}&quot;
                  </p>
                )}
              </div>
              <button
                className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setShowFontList(false);
                  setSearch("");
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={() => setShowFontList(true)}
            >
              + Add font
            </button>
          )}
        </div>

        {/* System font stack for UI — same style as font family list */}
        <div>
          <label className="block text-xs font-medium mb-1.5">
            System font family
          </label>

          {/* Current system font list */}
          <div className="space-y-1 mb-2">
            {style.systemFontFamilies.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded-md border bg-background px-2 py-1"
              >
                <span className="text-xs text-muted-foreground w-4 shrink-0">
                  {i + 1}.
                </span>
                <span
                  className="flex-1 truncate text-xs"
                  style={{ fontFamily: f }}
                >
                  {f}
                </span>
                <button
                  className="text-xs text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-30"
                  onClick={() => removeSystemFontFamily(i)}
                  disabled={style.systemFontFamilies.length <= 1}
                >
                  ✕
                </button>
                {i > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => {
                      const arr = [...style.systemFontFamilies];
                      [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                      setSystemFontFamilies(arr);
                    }}
                  >
                    ↑
                  </button>
                )}
                {i < style.systemFontFamilies.length - 1 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => {
                      const arr = [...style.systemFontFamilies];
                      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                      setSystemFontFamilies(arr);
                    }}
                  >
                    ↓
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add system font */}
          {showSystemFontList ? (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="w-full rounded-md border bg-background pl-7 pr-2 py-1.5 text-xs"
                  placeholder="Search fonts…"
                  value={search2}
                  onChange={(e) => setSearch2(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {filtered2.map((font) => {
                  const isAdded = style.systemFontFamilies.includes(font);
                  return (
                    <button
                      key={font}
                      className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors ${
                        isAdded
                          ? "text-muted-foreground cursor-default"
                          : "hover:bg-accent text-foreground"
                      }`}
                      onClick={() => {
                        if (!isAdded) {
                          addSystemFontFamily(font);
                          setShowSystemFontList(false);
                        }
                        setSearch2("");
                      }}
                    >
                      <span
                        className="flex-1 truncate"
                        style={{ fontFamily: font }}
                      >
                        {font}
                      </span>
                      {isAdded && (
                        <span className="text-primary shrink-0">✓</span>
                      )}
                    </button>
                  );
                })}
                {filtered2.length === 0 && (
                  <p className="px-2.5 py-3 text-xs text-muted-foreground text-center">
                    No fonts match &quot;{search2}&quot;
                  </p>
                )}
              </div>
              <button
                className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setShowSystemFontList(false);
                  setSearch2("");
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={() => {
                setShowSystemFontList(true);
                setSearch2("");
              }}
            >
              + Add font
            </button>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Controls all UI text (buttons, bars, lists, panels).
          </p>
        </div>

        {/* Font size */}
        <div>
          <label className="block text-xs font-medium mb-1.5">
            Font size: {style.fontSize}px
          </label>
          <input
            type="range"
            min="12"
            max="24"
            step="1"
            className="w-full"
            value={style.fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
          />
        </div>

        {/* System font size */}
        <div>
          <label className="block text-xs font-medium mb-1.5">
            System Font size: {style.globalFontSize}px
          </label>
          <input
            type="range"
            min="12"
            max="24"
            step="1"
            className="w-full"
            value={style.globalFontSize}
            onChange={(e) => setGlobalFontSize(parseInt(e.target.value, 10))}
          />
        </div>
      </div>

      {/* PDF scrollbar toggle */}
      <div className="flex items-center gap-2 mt-5">
        <input
          type="checkbox"
          id="pdfScrollbar"
          className="rounded"
          checked={style.pdfScrollbar}
          onChange={(e) => setPdfScrollbar(e.target.checked)}
        />
        <label htmlFor="pdfScrollbar" className="text-xs">
          Show PDF scrollbar (floating overlay)
        </label>
      </div>

      {/* Learn panel height */}
      <div className="mt-5">
        <label className="block text-xs font-medium mb-1.5">
          Learn panel height: {style.learnPanelHeight}px
        </label>
        <input
          type="range"
          min="400"
          max="1000"
          step="10"
          className="w-full"
          value={style.learnPanelHeight}
          onChange={(e) => setLearnPanelHeight(parseInt(e.target.value, 10))}
        />
      </div>

      {/* ── Theme settings ── */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-xs font-semibold mb-3">Theme</h3>

        {/* Theme mode */}
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5">
            Light/Dark mode
          </label>
          <div className="flex gap-2">
            {(["auto", "light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  themeConfig.themeMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/50 text-muted-foreground hover:bg-accent"
                }`}
                onClick={() => setThemeMode(mode)}
              >
                {mode === "auto" ? "Auto" : mode === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>

        {/* Light flavor */}
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1">Light theme</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
            value={themeConfig.lightTheme}
            onChange={(e) => setLightTheme(e.target.value as any)}
          >
            <option value="latte">Latte</option>
          </select>
        </div>

        {/* Dark flavor */}
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1">Dark theme</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
            value={themeConfig.darkTheme}
            onChange={(e) => setDarkTheme(e.target.value as any)}
          >
            <option value="frappe">Frappé</option>
            <option value="macchiato">Macchiato</option>
            <option value="mocha">Mocha</option>
          </select>
        </div>

        {/* PDF dark invert */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="pdfDarkInvert"
            className="rounded"
            checked={themeConfig.pdfDarkInvert}
            onChange={(e) => setPdfDarkInvert(e.target.checked)}
          />
          <label htmlFor="pdfDarkInvert" className="text-xs">
            Invert PDF in dark mode
          </label>
        </div>
      </div>

      <div className="mt-4 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-destructive"
          onClick={reset}
        >
          Reset to defaults
        </Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// TTS Config content (inside unified settings)
// ---------------------------------------------------------------------------
function TTSConfigContent() {
  const config = useTTSStore((s) => s.config);
  const setConfig = useTTSStore((s) => s.setConfig);
  const refreshVoices = useTTSStore((s) => s.refreshVoices);
  const loadingVoices = useTTSStore((s) => s.loadingVoices);
  const voiceLists = useTTSStore((s) => s.config.voiceLists);
  const hasCachedLists = Object.keys(voiceLists).some(
    (k) => voiceLists[k].length > 0,
  );

  // Auto-fetch voice list on first open if not cached
  useEffect(() => {
    if (!hasCachedLists) {
      refreshVoices();
    }
  }, [hasCachedLists, refreshVoices]);

  const langMeta = [
    { id: "zh", label: "简体中文" },
    { id: "en", label: "English" },
    { id: "de", label: "Deutsch" },
    { id: "ja", label: "日本語" },
    { id: "fr", label: "Français" },
    { id: "es", label: "Español" },
  ];

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Volume2 className="h-5 w-5" />
        <h2 className="text-base font-semibold">
          TTS{config.provider === "mimo" ? " (MiMo)" : " (Edge-TTS)"}
        </h2>
      </div>

      <div className="space-y-4">

        {/* Provider selector */}
        <div>
          <label className="block text-xs font-medium mb-1">Provider</label>
          <div className="flex gap-2">
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                config.provider === "edge-tts"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/50 text-muted-foreground hover:bg-accent"
              }`}
              onClick={() => setConfig({ provider: "edge-tts" })}
            >
              Edge-TTS
            </button>
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                config.provider === "mimo"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/50 text-muted-foreground hover:bg-accent"
              }`}
              onClick={() => setConfig({ provider: "mimo" })}
            >
              MiMo TTS
            </button>
          </div>
        </div>

        {/* ── Edge-TTS settings ── */}
        {config.provider === "edge-tts" && (
          <>
            {/* Binary path */}
            <div>
              <label className="block text-xs font-medium mb-1">
                Binary path
              </label>
              <input
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                value={config.binaryPath}
                onChange={(e) => setConfig({ binaryPath: e.target.value })}
                placeholder="edge-tts (via PATH)"
              />
              <p className="text-xs text-muted-foreground mt-0.5">
                Absolute path or leave empty to search via PATH.
              </p>
            </div>

            {/* Rate / Volume / Pitch */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Rate: {config.rate}
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={parseInt(config.rate.replace(/[+%]/g, ""))}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    const sign = v >= 0 ? "+" : "";
                    setConfig({ rate: `${sign}${v}%` });
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Volume: {config.volume}
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={parseInt(config.volume.replace(/[+%]/g, ""))}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    const sign = v >= 0 ? "+" : "";
                    setConfig({ volume: `${sign}${v}%` });
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Pitch: {config.pitch}
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={parseInt(config.pitch.replace(/[+Hz]/g, ""))}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    const sign = v >= 0 ? "+" : "";
                    setConfig({ pitch: `${sign}${v}Hz` });
                  }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Per-language voices */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium">
                  Voices (per language)
                </label>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  onClick={() => refreshVoices()}
                  disabled={loadingVoices}
                  title="Refresh voice list from edge-tts --list-voices"
                >
                  {loadingVoices ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                    </svg>
                  )}
                  Refresh
                </button>
              </div>
              <div className="space-y-1.5">
                {langMeta.map((lang) => {
                  const list = config.voiceLists[lang.id];
                  const current = config.perLanguageVoices[lang.id] ?? "";
                  return (
                    <div key={lang.id} className="flex items-center gap-2">
                      <span className="text-xs w-16 shrink-0">
                        {lang.label}
                      </span>
                      {list && list.length > 0 ? (
                        <select
                          className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                          value={list.includes(current) ? current : ""}
                          onChange={(e) =>
                            setConfig({
                              perLanguageVoices: {
                                ...config.perLanguageVoices,
                                [lang.id]: e.target.value,
                              },
                            })
                          }
                        >
                          {current && !list.includes(current) && (
                            <option value={current}>{current}</option>
                          )}
                          {list.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                          value={current}
                          onChange={(e) =>
                            setConfig({
                              perLanguageVoices: {
                                ...config.perLanguageVoices,
                                [lang.id]: e.target.value,
                              },
                            })
                          }
                          placeholder="auto"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Requires <code>pip install edge-tts</code> · Voices provided by
              Microsoft Edge online TTS.
            </p>
          </>
        )}

        {/* ── MiMo settings ── */}
        {config.provider === "mimo" && (
          <>
            {/* API Key */}
            <div>
              <label className="block text-xs font-medium mb-1">API Key</label>
              <input
                type="password"
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                value={config.mimoApiKey}
                onChange={(e) => setConfig({ mimoApiKey: e.target.value })}
                placeholder="mimo-xxx..."
              />
              <p className="text-xs text-muted-foreground mt-0.5">
                Get your API key from{" "}
                <a
                  className="underline"
                  href="https://mimo.mi.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  mimo.mi.com
                </a>
              </p>
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-medium mb-1">Model</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                value={config.mimoModel}
                onChange={(e) => setConfig({ mimoModel: e.target.value })}
              >
                {MIMO_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Voice */}
            <div>
              <label className="block text-xs font-medium mb-1">Voice</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                value={
                  MIMO_PRESET_VOICES.some((v) => v.id === config.mimoVoice)
                    ? config.mimoVoice
                    : "custom"
                }
                onChange={(e) => {
                  if (e.target.value === "custom") return;
                  setConfig({ mimoVoice: e.target.value });
                }}
              >
                {MIMO_PRESET_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
                {!MIMO_PRESET_VOICES.some((v) => v.id === config.mimoVoice) && (
                  <option value="custom">{config.mimoVoice}</option>
                )}
              </select>
              {/* Custom voice input */}
              {!MIMO_PRESET_VOICES.some((v) => v.id === config.mimoVoice) && (
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                  value={config.mimoVoice}
                  onChange={(e) => setConfig({ mimoVoice: e.target.value })}
                  placeholder="Custom voice ID"
                />
              )}
            </div>

            {/* Style prompt */}
            <div>
              <label className="block text-xs font-medium mb-1">
                Style prompt{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (tone description)
                </span>
              </label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs resize-none"
                rows={2}
                value={config.mimoStylePrompt}
                onChange={(e) => setConfig({ mimoStylePrompt: e.target.value })}
                placeholder="e.g. Bright, bouncy tone."
              />
              <p className="text-xs text-muted-foreground mt-0.5">
                Sent as a <code>user</code> message before the text. Use{" "}
                <strong>Director Mode</strong> for detailed control:{" "}
                <code>{"【角色】... 【场景】... 【指导】..."}</code>
              </p>
            </div>

            {/* Inline audio tag */}
            <div>
              <label className="block text-xs font-medium mb-1">
                Inline tag{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (prepended to text)
                </span>
              </label>
              <input
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                value={config.mimoInlineTag}
                onChange={(e) => setConfig({ mimoInlineTag: e.target.value })}
                placeholder="e.g. (温柔) or (紧张，深呼吸)"
              />
              <p className="text-xs text-muted-foreground mt-0.5">
                Wrap in parentheses. Examples: <code>(开心)</code>{" "}
                <code>(颤抖)</code> <code>(轻声笑)</code>.
              </p>
              <details className="mt-1">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Quick tags
                </summary>
                <div className="mt-1 flex flex-wrap gap-1">
                  {[
                    "开心",
                    "悲伤",
                    "愤怒",
                    "温柔",
                    "活泼",
                    "严肃",
                    "慵懒",
                    "俏皮",
                    "紧张",
                    "激动",
                    "疲惫",
                    "委屈",
                    "撒娇",
                    "害怕",
                    "颤抖",
                    "气声",
                    "鼻音",
                    "沙哑",
                    "轻笑",
                    "哽咽",
                    "抽泣",
                    "吸气",
                    "深呼吸",
                    "叹气",
                    "喘息",
                  ].map((tag) => (
                    <button
                      key={tag}
                      className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                        config.mimoInlineTag === `(${tag})`
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                      onClick={() =>
                        setConfig({
                          mimoInlineTag:
                            config.mimoInlineTag === `(${tag})`
                              ? ""
                              : `(${tag})`,
                        })
                      }
                    >
                      ({tag})
                    </button>
                  ))}
                </div>
              </details>
            </div>

            <p className="text-xs text-muted-foreground">
              Powered by XiaoMi MiMo API ·{" "}
              <a
                className="underline"
                href="https://mimo.mi.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                mimo.mi.com
              </a>
            </p>
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Keyboard Shortcuts content (inside unified settings)
// ---------------------------------------------------------------------------
function ShortcutsContent() {
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
        <div className="mb-3 rounded-md border border-primary bg-primary/5 px-3 py-2 text-xs text-primary">
          Press the key combination for this shortcut (or Escape to cancel)...
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(groups).map(([context, items]) => {
          const visible = items.filter((s) => !s.locked);
          if (visible.length === 0) return null;
          return (
            <div key={context}>
              <h3 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                {contextLabels[context] ?? context}
              </h3>
              <div className="space-y-1">
                {visible.map((s) => (
                  <div
                    key={s.actionId}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent transition-colors text-xs gap-2"
                  >
                    <span className="text-foreground min-w-0 flex-1">
                      {s.label}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {editingId === s.actionId ? (
                        <span className="inline-flex items-center rounded border border-primary bg-primary/10 px-2 py-0.5 text-xs font-mono">
                          (listening...)
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-mono">
                          {formatShortcut(s.keys)}
                        </span>
                      )}
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground ml-1"
                        onClick={() => handleStartCapture(s.actionId)}
                        title="Change shortcut"
                      >
                        ✎
                      </button>
                      {s.keys !== s.defaultKeys && (
                        <button
                          className="text-xs text-muted-foreground hover:text-destructive"
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
          className="text-xs text-destructive"
          onClick={resetAllShortcuts}
        >
          Reset all to defaults
        </Button>
      </div>
    </>
  );
}

interface CenterPanelProps {
  documentPath?: string | null;
  documentId?: string | null;
  leftCollapsed?: boolean;
  rightCollapsed?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}

export function CenterPanel({
  documentPath,
  documentId,
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
}: CenterPanelProps) {
  const setItems = useAnnotationStore((s) => s.setItems);
  const loadedDocRef = useRef<string | null>(null);
  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const currentPage = usePdfViewerStore((s) => s.currentPage);
  const [showStats, setShowStats] = useState(false);
  useShortcut("toggleStats", () => setShowStats((s) => !s));

  // Load annotations from Electron backend when document changes
  useEffect(() => {
    if (!documentId) {
      setItems([]);
      loadedDocRef.current = null;
      return;
    }

    loadedDocRef.current = documentId;

    window.siltflow.annotations.list(documentId).then(async (saved) => {
      if (loadedDocRef.current !== documentId) return;

      // Load ai_results and fsrs_cards for all annotations in batch
      const aiResults = new Map<string, any>();
      const fsrsCards = new Map<string, any>();
      for (const a of saved || []) {
        try {
          const r = await window.siltflow.aiResults.get(a.id, a.documentId);
          if (r) aiResults.set(a.id, JSON.parse(r));
        } catch {
          /* not found */
        }
        try {
          const c = await window.siltflow.fsrsCards.get(a.id, a.documentId);
          if (c) fsrsCards.set(a.id, JSON.parse(c));
        } catch {
          /* not found */
        }
      }

      setItems(
        (saved || []).map((a: any) => ({
          id: a.id,
          documentId: a.documentId,
          type: a.type,
          text: a.text || "",
          pageNumber: a.pageNumber ?? 1,
          embedData: JSON.parse(a.embedData) as AnnotationEmbedData,
          aiResult: aiResults.get(a.id) ?? undefined,
          fsrsCard: fsrsCards.get(a.id) ?? undefined,
        })),
      );
    });
  }, [documentId, setItems]);

  const docTitle = currentDocument?.title ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* ── unified toolbar ── */}
      <div className="flex h-10 items-center gap-1 border-b px-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onToggleLeft}
        >
          {leftCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setShowStats(true)}
          title="Statistics (Ctrl+D)"
        >
          <BarChart3 className="h-4 w-4" />
        </Button>

        <h1 className="flex-1 truncate text-center text-sm font-medium min-w-0">
          {docTitle || "Siltflow"}
        </h1>

        <div className="flex items-center gap-2 shrink-0">
          {docTitle && <PageNav />}
          {docTitle && <QuickAddToggle />}
          {docTitle && <FitWidthButton />}
          <SyncButton />
          <SettingsButton />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onToggleRight}
          >
            {rightCollapsed ? (
              <PanelRightOpen className="h-4 w-4" />
            ) : (
              <PanelRightClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* ── content ── */}
      {docTitle ? (
        <div className="flex-1 min-h-0 relative">
          {/* Sticky progress bar */}
          <div className="absolute top-0 left-0 right-0 z-10 h-1 pointer-events-none">
            <div className="relative h-full w-full bg-teal/10">
              <div
                className="absolute inset-y-0 left-0 bg-sky transition-[width] duration-150 ease-out"
                style={{
                  width: currentDocument?.totalPages
                    ? `${(Math.min(currentPage, currentDocument.totalPages) / currentDocument.totalPages) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>
          <PdfViewer
            className="h-full w-full"
            src={documentPath!}
            documentId={documentId!}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <BookOpen className="h-12 w-12" />
            <p className="text-sm">Select a document to start reading</p>
          </div>
        </div>
      )}

      {/* ── Statistics Dashboard Dialog ── */}
      <Dialog open={showStats} onOpenChange={(open) => { if (!open) setShowStats(false); }}>
        <DialogContent
          hideClose
          className="flex w-full max-w-5xl h-[calc(100vh-80px)] rounded-lg border bg-background shadow-xl p-0 gap-0"
        >
          <StatsDashboard onClose={() => setShowStats(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// About content (inside unified settings)
// ---------------------------------------------------------------------------
function AboutContent() {
  const [updateState, setUpdateState] = useState<
    | "idle"
    | "checking"
    | "available"
    | "latest"
    | "downloading"
    | "downloaded"
    | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkUpdateOnStartup = useAppSettingsStore(
    (s) => s.checkUpdateOnStartup,
  );
  const setCheckUpdateOnStartup = useAppSettingsStore(
    (s) => s.setCheckUpdateOnStartup,
  );

  const currentVersion = __APP_VERSION__;
  const releasesUrl = "https://github.com/TYBLHQY/siltflow/releases";

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      window.siltflow.update.onAvailable((info: any) => {
        const tag = info?.version || info?.tag_name || "";
        setLatestVersion(tag.startsWith("v") ? tag.slice(1) : tag);
        setUpdateState("available");
      }),
    );

    unsubs.push(
      window.siltflow.update.onNotAvailable(() => {
        setLatestVersion(null);
        setUpdateState("latest");
      }),
    );

    unsubs.push(
      window.siltflow.update.onDownloadProgress((p) => {
        setProgress(p.percent);
        setUpdateState("downloading");
      }),
    );

    unsubs.push(
      window.siltflow.update.onDownloaded(() => {
        setUpdateState("downloaded");
      }),
    );

    unsubs.push(
      window.siltflow.update.onError((msg) => {
        setErrorMsg(msg);
        setUpdateState("error");
      }),
    );

    return () => unsubs.forEach((fn) => fn());
  }, []);

  const handleCheck = () => {
    setUpdateState("checking");
    setErrorMsg(null);
    window.siltflow.update.check();
  };

  const handleDownload = () => {
    setUpdateState("downloading");
    setProgress(0);
    window.siltflow.update.download();
  };

  const handleInstall = () => {
    window.siltflow.update.install();
  };

  return (
    <div className="space-y-5 pt-3">
      {/* App info */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Siltflow</h3>
        <p className="text-xs text-muted-foreground">
          A language learning document reader with spaced repetition and AI
          translation.
        </p>
      </div>

      {/* Version */}
      <div className="space-y-1">
        <label className="block text-xs font-medium">Current Version</label>
        <p className="text-sm">{currentVersion}</p>
      </div>

      {/* Update */}
      <div className="space-y-2">
        <label className="block text-xs font-medium">Updates</label>

        {/* Auto-check toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="checkUpdateOnStartup"
            className="rounded"
            checked={checkUpdateOnStartup}
            onChange={(e) => setCheckUpdateOnStartup(e.target.checked)}
          />
          <label htmlFor="checkUpdateOnStartup" className="text-xs">
            Check for updates on startup
          </label>
        </div>

        {updateState === "checking" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking for updates…
          </div>
        )}

        {updateState === "available" && (
          <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2">
            <p className="text-xs font-medium text-green-600 mb-1.5">
              v{latestVersion} is available
            </p>
            <button
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={handleDownload}
            >
              <Download className="h-3 w-3" />
              Download Update
            </button>
          </div>
        )}

        {updateState === "latest" && (
          <p className="text-xs text-muted-foreground">
            You are on the latest version.
          </p>
        )}

        {updateState === "downloading" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Downloading…
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {updateState === "downloaded" && (
          <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2">
            <p className="text-xs font-medium text-blue-600 mb-1.5">
              Update ready to install
            </p>
            <button
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={handleInstall}
            >
              <Download className="h-3 w-3" />
              Restart &amp; Install
            </button>
          </div>
        )}

        {updateState === "error" && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
            <p className="text-xs font-medium text-red-600 mb-1">
              Update check failed
            </p>
            <p className="text-xs text-red-500 mb-1.5">{errorMsg}</p>
            <button
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={handleCheck}
            >
              Retry
            </button>
          </div>
        )}

        {updateState === "idle" && (
          <button
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={handleCheck}
          >
            <Download className="h-3 w-3" />
            Check for Updates
          </button>
        )}
      </div>

      {/* View on GitHub */}
      <div className="pt-2">
        <a
          href={releasesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View all releases on GitHub
        </a>
      </div>
    </div>
  );
}
