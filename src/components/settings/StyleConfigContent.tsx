import { useState } from "react";
import { Search, TextSelect } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStyleStore } from "@/stores/style.store";
import { useSystemFonts } from "@/hooks/useSystemFonts";
import { AVAILABLE_COLORS, getHighlightCSSVar } from "@/lib/colors";

export function StyleConfigContent() {
  const style = useStyleStore((s) => s.style);
  const setFontFamilies = useStyleStore((s) => s.setFontFamilies);
  const addFontFamily = useStyleStore((s) => s.addFontFamily);
  const removeFontFamily = useStyleStore((s) => s.removeFontFamily);
  const setFontSize = useStyleStore((s) => s.setFontSize);
  const setGlobalFontSize = useStyleStore((s) => s.setGlobalFontSize);
  const setPdfScrollbar = useStyleStore((s) => s.setPdfScrollbar);
  const setLearnPanelHeight = useStyleStore((s) => s.setLearnPanelHeight);
  const setAnnotationHighlightColor = useStyleStore(
    (s) => s.setAnnotationHighlightColor,
  );
  const setPlainHighlightColor = useStyleStore((s) => s.setPlainHighlightColor);
  const setSystemFontFamilies = useStyleStore((s) => s.setSystemFontFamilies);
  const addSystemFontFamily = useStyleStore((s) => s.addSystemFontFamily);
  const removeSystemFontFamily = useStyleStore((s) => s.removeSystemFontFamily);
  const reset = useStyleStore((s) => s.reset);
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
                className="flex items-center gap-1 rounded-md border bg-ctp-base px-2 py-1"
              >
                <span className="text-xs text-ctp-overlay0 w-4 shrink-0">
                  {i + 1}.
                </span>
                <span
                  className="flex-1 truncate text-xs"
                  style={{ fontFamily: f }}
                >
                  {f}
                </span>
                <button
                  className="text-xs text-ctp-overlay0 hover:text-ctp-red shrink-0 disabled:opacity-30"
                  onClick={() => removeFontFamily(i)}
                  disabled={style.fontFamilies.length <= 1}
                >
                  ✕
                </button>
                {i > 0 && (
                  <button
                    className="text-xs text-ctp-overlay0 hover:text-ctp-text shrink-0"
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
                    className="text-xs text-ctp-overlay0 hover:text-ctp-text shrink-0"
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
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ctp-overlay0" />
                <input
                  className="w-full rounded-md border bg-ctp-base pl-7 pr-2 py-1.5 text-xs"
                  placeholder="Search fonts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
                          ? "text-ctp-overlay0 cursor-default"
                          : "hover:bg-ctp-surface0 text-ctp-text"
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
                        <span className="text-ctp-mauve shrink-0">✓</span>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="px-2.5 py-3 text-xs text-ctp-overlay0 text-center">
                    No fonts match &quot;{search}&quot;
                  </p>
                )}
              </div>
              <button
                className="mt-1 text-xs text-ctp-overlay0 hover:text-ctp-text"
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
              className="flex items-center gap-1 rounded-md border border-ctp-overlay0/50 bg-ctp-surface0/40 px-3 py-1.5 text-xs text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-text transition-colors"
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
                className="flex items-center gap-1 rounded-md border bg-ctp-base px-2 py-1"
              >
                <span className="text-xs text-ctp-overlay0 w-4 shrink-0">
                  {i + 1}.
                </span>
                <span
                  className="flex-1 truncate text-xs"
                  style={{ fontFamily: f }}
                >
                  {f}
                </span>
                <button
                  className="text-xs text-ctp-overlay0 hover:text-ctp-red shrink-0 disabled:opacity-30"
                  onClick={() => removeSystemFontFamily(i)}
                  disabled={style.systemFontFamilies.length <= 1}
                >
                  ✕
                </button>
                {i > 0 && (
                  <button
                    className="text-xs text-ctp-overlay0 hover:text-ctp-text shrink-0"
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
                    className="text-xs text-ctp-overlay0 hover:text-ctp-text shrink-0"
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
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ctp-overlay0" />
                <input
                  className="w-full rounded-md border bg-ctp-base pl-7 pr-2 py-1.5 text-xs"
                  placeholder="Search fonts…"
                  value={search2}
                  onChange={(e) => setSearch2(e.target.value)}
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
                          ? "text-ctp-overlay0 cursor-default"
                          : "hover:bg-ctp-surface0 text-ctp-text"
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
                        <span className="text-ctp-mauve shrink-0">✓</span>
                      )}
                    </button>
                  );
                })}
                {filtered2.length === 0 && (
                  <p className="px-2.5 py-3 text-xs text-ctp-overlay0 text-center">
                    No fonts match &quot;{search2}&quot;
                  </p>
                )}
              </div>
              <button
                className="mt-1 text-xs text-ctp-overlay0 hover:text-ctp-text"
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
              className="flex items-center gap-1 rounded-md border border-ctp-overlay0/50 bg-ctp-surface0/40 px-3 py-1.5 text-xs text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-text transition-colors"
              onClick={() => {
                setShowSystemFontList(true);
                setSearch2("");
              }}
            >
              + Add font
            </button>
          )}
          <p className="text-xs text-ctp-overlay0 mt-1">
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
            onChange={(e) => setFontSize(Number.parseInt(e.target.value, 10))}
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
            onChange={(e) =>
              setGlobalFontSize(Number.parseInt(e.target.value, 10))
            }
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
          onChange={(e) =>
            setLearnPanelHeight(Number.parseInt(e.target.value, 10))
          }
        />
      </div>

      {/* ── Highlight colors ── */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-xs font-semibold mb-3">Highlight Colors</h3>

        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5">
            Annotation highlight color
          </label>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_COLORS.map((color) => {
              const cssVar = getHighlightCSSVar(color);
              const isSelected = style.annotationHighlightColor === color;
              return (
                <button
                  key={color}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${
                    isSelected
                      ? "border-ctp-text ring-2 ring-ctp-mauve"
                      : "border-transparent hover:border-ctp-overlay0"
                  }`}
                  style={{ backgroundColor: cssVar }}
                  onClick={() => setAnnotationHighlightColor(color)}
                  title={color}
                />
              );
            })}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5">
            Plain highlight color
          </label>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_COLORS.map((color) => {
              const cssVar = getHighlightCSSVar(color);
              const isSelected = style.plainHighlightColor === color;
              return (
                <button
                  key={color}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${
                    isSelected
                      ? "border-ctp-text ring-2 ring-ctp-mauve"
                      : "border-transparent hover:border-ctp-overlay0"
                  }`}
                  style={{ backgroundColor: cssVar }}
                  onClick={() => setPlainHighlightColor(color)}
                  title={color}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-ctp-red"
          onClick={reset}
        >
          Reset to defaults
        </Button>
      </div>
    </>
  );
}
