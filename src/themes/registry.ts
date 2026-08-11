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
] as const satisfies readonly ThemeDefinition[];

/** 19 个主题 id 的字面量联合类型。 */
export type ThemeFlavor = (typeof THEMES)[number]["id"];

/** App.tsx 切换主题时用来清除残留 class 的完整清单。 */
export const THEME_IDS: ThemeFlavor[] = THEMES.map((t) => t.id);

/** 浅色主题（进 Light theme 下拉框）。 */
export const LIGHT_THEMES = THEMES.filter((t) => t.kind === "light");

/** 深色主题（进 Dark theme 下拉框）。 */
export const DARK_THEMES = THEMES.filter((t) => t.kind === "dark");
