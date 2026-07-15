import { useState, useEffect } from "react";
import { Search, TextSelect } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStyleStore } from "@/stores/style.store";
import { useThemeStore } from "@/stores/theme.store";

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

export function StyleConfigContent() {
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
