export interface ThemeDefinition {
  /** 主题 id，同时也是 <html> 上切换用的 CSS class 名。定义为 string 而非 ThemeFlavor，
   *  避免在推导出 ThemeFlavor 之前出现循环引用。 */
  id: string;
  /** 设置页下拉框显示名。 */
  label: string;
  kind: "light" | "dark";
  /** <optgroup> 分组名（配色家族）。 */
  group: string;
}

const THEMES = [
  { id: "latte", label: "Latte", kind: "light", group: "Catppuccin" },
  { id: "frappe", label: "Frappé", kind: "dark", group: "Catppuccin" },
  { id: "macchiato", label: "Macchiato", kind: "dark", group: "Catppuccin" },
  { id: "mocha", label: "Mocha", kind: "dark", group: "Catppuccin" },
  { id: "nord", label: "Nord", kind: "dark", group: "Nord" },
  { id: "nord-light", label: "Nord Light", kind: "light", group: "Nord" },
  { id: "dracula", label: "Dracula", kind: "dark", group: "Dracula" },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    kind: "dark",
    group: "Tokyo Night",
  },
  {
    id: "tokyo-night-light",
    label: "Tokyo Night Light",
    kind: "light",
    group: "Tokyo Night",
  },
  { id: "rose-pine", label: "Rose Pine", kind: "dark", group: "Rose Pine" },
  {
    id: "rose-pine-dawn",
    label: "Rose Pine Dawn",
    kind: "light",
    group: "Rose Pine",
  },
  { id: "gruvbox", label: "Gruvbox", kind: "dark", group: "Gruvbox" },
  {
    id: "gruvbox-light",
    label: "Gruvbox Light",
    kind: "light",
    group: "Gruvbox",
  },
  { id: "kanagawa", label: "Kanagawa", kind: "dark", group: "Kanagawa" },
  {
    id: "kanagawa-lotus",
    label: "Kanagawa Lotus",
    kind: "light",
    group: "Kanagawa",
  },
  { id: "everforest", label: "Everforest", kind: "dark", group: "Everforest" },
  {
    id: "everforest-light",
    label: "Everforest Light",
    kind: "light",
    group: "Everforest",
  },
  { id: "solarized", label: "Solarized", kind: "dark", group: "Solarized" },
  {
    id: "solarized-light",
    label: "Solarized Light",
    kind: "light",
    group: "Solarized",
  },
  { id: "onedark", label: "One Dark", kind: "dark", group: "One Dark" },
  { id: "monokai", label: "Monokai", kind: "dark", group: "Monokai" },
  {
    id: "github-dark",
    label: "GitHub Dark",
    kind: "dark",
    group: "GitHub",
  },
  {
    id: "github-light",
    label: "GitHub Light",
    kind: "light",
    group: "GitHub",
  },
  { id: "nordfox", label: "Nordfox", kind: "dark", group: "Nord" },
  { id: "nord-wave", label: "Nord Wave", kind: "dark", group: "Nord" },
  { id: "onenord", label: "Onenord", kind: "dark", group: "Nord" },
  { id: "onenord-light", label: "Onenord Light", kind: "light", group: "Nord" },
  { id: "dracula-plus", label: "Dracula+", kind: "dark", group: "Dracula" },
  {
    id: "tokyo-night-moon",
    label: "Tokyo Night Moon",
    kind: "dark",
    group: "Tokyo Night",
  },
  {
    id: "tokyo-night-storm",
    label: "Tokyo Night Storm",
    kind: "dark",
    group: "Tokyo Night",
  },
  {
    id: "rose-pine-moon",
    label: "Rose Pine Moon",
    kind: "dark",
    group: "Rose Pine",
  },
  {
    id: "gruvbox-dark-hard",
    label: "Gruvbox Dark Hard",
    kind: "dark",
    group: "Gruvbox",
  },
  {
    id: "gruvbox-light-hard",
    label: "Gruvbox Light Hard",
    kind: "light",
    group: "Gruvbox",
  },
  {
    id: "gruvbox-material-dark",
    label: "Gruvbox Material Dark",
    kind: "dark",
    group: "Gruvbox",
  },
  {
    id: "gruvbox-material",
    label: "Gruvbox Material",
    kind: "dark",
    group: "Gruvbox",
  },
  {
    id: "gruvbox-material-light",
    label: "Gruvbox Material Light",
    kind: "light",
    group: "Gruvbox",
  },
  {
    id: "kanagawa-dragon",
    label: "Kanagawa Dragon",
    kind: "dark",
    group: "Kanagawa",
  },
  {
    id: "kanagawabones",
    label: "Kanagawabones",
    kind: "dark",
    group: "Kanagawa",
  },
  {
    id: "everforest-dark-hard",
    label: "Everforest Dark Hard",
    kind: "dark",
    group: "Everforest",
  },
  {
    id: "everforest-dark-soft",
    label: "Everforest Dark Soft",
    kind: "dark",
    group: "Everforest",
  },
  {
    id: "everforest-light-hard",
    label: "Everforest Light Hard",
    kind: "light",
    group: "Everforest",
  },
  {
    id: "everforest-light-soft",
    label: "Everforest Light Soft",
    kind: "light",
    group: "Everforest",
  },
  {
    id: "solarized-dark-higher-contrast",
    label: "Solarized Dark HC",
    kind: "dark",
    group: "Solarized",
  },
  {
    id: "solarized-dark-patched",
    label: "Solarized Dark Patched",
    kind: "dark",
    group: "Solarized",
  },
  {
    id: "solarized-darcula",
    label: "Solarized Darcula",
    kind: "dark",
    group: "Solarized",
  },
  {
    id: "solarized-osaka-night",
    label: "Solarized Osaka Night",
    kind: "dark",
    group: "Solarized",
  },
  {
    id: "atom-one-light",
    label: "Atom One Light",
    kind: "light",
    group: "One Dark",
  },
  {
    id: "one-dark-two",
    label: "One Dark Two",
    kind: "dark",
    group: "One Dark",
  },
  {
    id: "one-double-dark",
    label: "One Double Dark",
    kind: "dark",
    group: "One Dark",
  },
  {
    id: "one-double-light",
    label: "One Double Light",
    kind: "light",
    group: "One Dark",
  },
  {
    id: "one-half-dark",
    label: "One Half Dark",
    kind: "dark",
    group: "One Dark",
  },
  {
    id: "one-half-light",
    label: "One Half Light",
    kind: "light",
    group: "One Dark",
  },
  { id: "doom-one", label: "Doom One", kind: "dark", group: "One Dark" },
  { id: "monokai-pro", label: "Monokai Pro", kind: "dark", group: "Monokai" },
  {
    id: "monokai-pro-light",
    label: "Monokai Pro Light",
    kind: "light",
    group: "Monokai",
  },
  {
    id: "monokai-pro-light-sun",
    label: "Monokai Pro Light Sun",
    kind: "light",
    group: "Monokai",
  },
  {
    id: "monokai-pro-machine",
    label: "Monokai Pro Machine",
    kind: "dark",
    group: "Monokai",
  },
  {
    id: "monokai-pro-octagon",
    label: "Monokai Pro Octagon",
    kind: "dark",
    group: "Monokai",
  },
  {
    id: "monokai-pro-ristretto",
    label: "Monokai Pro Ristretto",
    kind: "dark",
    group: "Monokai",
  },
  {
    id: "monokai-pro-spectrum",
    label: "Monokai Pro Spectrum",
    kind: "dark",
    group: "Monokai",
  },
  {
    id: "monokai-remastered",
    label: "Monokai Remastered",
    kind: "dark",
    group: "Monokai",
  },
  { id: "monokai-soda", label: "Monokai Soda", kind: "dark", group: "Monokai" },
  {
    id: "monokai-sublime-text",
    label: "Monokai SublimeText",
    kind: "dark",
    group: "Monokai",
  },
  {
    id: "monokai-vivid",
    label: "Monokai Vivid",
    kind: "dark",
    group: "Monokai",
  },
  {
    id: "monokai-dimmed",
    label: "Monokai Dimmed",
    kind: "dark",
    group: "Monokai",
  },
  {
    id: "github-dark-dimmed",
    label: "GitHub Dark Dimmed",
    kind: "dark",
    group: "GitHub",
  },
  {
    id: "github-dark-high-contrast",
    label: "GitHub Dark High Contrast",
    kind: "dark",
    group: "GitHub",
  },
  {
    id: "github-light-high-contrast",
    label: "GitHub Light High Contrast",
    kind: "light",
    group: "GitHub",
  },
  {
    id: "github-dark-colorblind",
    label: "GitHub Dark Colorblind",
    kind: "dark",
    group: "GitHub",
  },
  {
    id: "github-light-colorblind",
    label: "GitHub Light Colorblind",
    kind: "light",
    group: "GitHub",
  },
  { id: "material", label: "Material", kind: "light", group: "Material" },
  {
    id: "material-dark",
    label: "Material Dark",
    kind: "dark",
    group: "Material",
  },
  {
    id: "material-darker",
    label: "Material Darker",
    kind: "dark",
    group: "Material",
  },
  {
    id: "material-ocean",
    label: "Material Ocean",
    kind: "dark",
    group: "Material",
  },
  {
    id: "material-design-colors",
    label: "Material Design Colors",
    kind: "dark",
    group: "Material",
  },
  {
    id: "oceanic-material",
    label: "Oceanic Material",
    kind: "dark",
    group: "Material",
  },
  {
    id: "jetbrains-darcula",
    label: "JetBrains Darcula",
    kind: "dark",
    group: "JetBrains",
  },
  {
    id: "jetbrains-islands-dark",
    label: "JetBrains Islands Dark",
    kind: "dark",
    group: "JetBrains",
  },
  { id: "obsidian", label: "Obsidian", kind: "dark", group: "Obsidian" },
] as const satisfies readonly ThemeDefinition[];

/** 所有主题 id 的字面量联合类型。 */
export type ThemeFlavor = (typeof THEMES)[number]["id"];

/** App.tsx 切换主题时用来清除残留 class 的完整清单。 */
export const THEME_IDS: ThemeFlavor[] = THEMES.map((t) => t.id);

/** 浅色主题（进 Light theme 下拉框）。 */
export const LIGHT_THEMES = THEMES.filter((t) => t.kind === "light");

/** 深色主题（进 Dark theme 下拉框）。 */
export const DARK_THEMES = THEMES.filter((t) => t.kind === "dark");
