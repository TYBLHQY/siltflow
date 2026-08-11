import { Check, Palette } from "lucide-react";
import { useThemeStore } from "@/stores/theme.store";
import { DARK_THEMES, LIGHT_THEMES } from "@/themes/registry";

function ThemeItem({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      className={`flex min-w-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
        active
          ? "bg-ctp-mauve text-ctp-crust font-medium"
          : "border border-ctp-overlay0/50 text-ctp-text hover:bg-ctp-surface0"
      }`}
      onClick={onClick}
    >
      <span className="truncate">{label}</span>
      {active && <Check className="ml-auto h-3 w-3 shrink-0" />}
    </button>
  );
}

export function ThemeConfigContent() {
  const themeConfig = useThemeStore((s) => s.config);
  const setLightTheme = useThemeStore((s) => s.setLightTheme);
  const setDarkTheme = useThemeStore((s) => s.setDarkTheme);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const setPdfDarkInvert = useThemeStore((s) => s.setPdfDarkInvert);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Palette className="h-5 w-5" />
        <h2 className="text-base font-semibold">Theme</h2>
      </div>

      <div className="space-y-4">
        {/* Theme mode */}
        <div>
          <label className="block text-xs font-medium mb-1.5">
            Light/Dark mode
          </label>
          <div className="flex gap-2">
            {(["auto", "light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  themeConfig.themeMode === mode
                    ? "bg-ctp-mauve text-ctp-crust"
                    : "border border-ctp-overlay0/50 text-ctp-overlay0 hover:bg-ctp-surface0"
                }`}
                onClick={() => setThemeMode(mode)}
              >
                {mode === "auto" ? "Auto" : mode === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>

        {/* Light theme — 平铺可点击列表 */}
        <div>
          <label className="block text-xs font-medium mb-1.5">
            Light theme
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {LIGHT_THEMES.map((t) => (
              <ThemeItem
                key={t.id}
                active={themeConfig.lightTheme === t.id}
                onClick={() => setLightTheme(t.id)}
                label={t.label}
              />
            ))}
          </div>
        </div>

        {/* Dark theme — 平铺可点击列表 */}
        <div>
          <label className="block text-xs font-medium mb-1.5">Dark theme</label>
          <div className="grid grid-cols-2 gap-1.5">
            {DARK_THEMES.map((t) => (
              <ThemeItem
                key={t.id}
                active={themeConfig.darkTheme === t.id}
                onClick={() => setDarkTheme(t.id)}
                label={t.label}
              />
            ))}
          </div>
        </div>

        {/* PDF dark mode scheme */}
        <div>
          <label className="block text-xs font-medium mb-1.5">
            PDF dark mode
          </label>
          <select
            className="w-full rounded-md border bg-ctp-base px-3 py-1.5 text-xs"
            value={themeConfig.pdfDarkInvert}
            onChange={(e) =>
              setPdfDarkInvert(e.target.value as "off" | "invert" | "themed")
            }
          >
            <option value="off">Off — original colors</option>
            <option value="invert">
              Invert — black background, white text
            </option>
            <option value="themed">Themed — matches app background</option>
          </select>
        </div>
      </div>
    </>
  );
}
