import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../themeContext";
import type { Theme } from "../lib/theme";

const CYCLE: Record<Theme, Theme> = {
  auto: "light",
  light: "dark",
  dark: "auto",
};

const LABEL: Record<Theme, string> = {
  auto: "Auto (system)",
  light: "Light",
  dark: "Dark",
};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      className="icon-button"
      onClick={() => setTheme(CYCLE[theme])}
      title={`Theme: ${LABEL[theme]} (click to change)`}
      aria-label={`Change theme. Current: ${LABEL[theme]}.`}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
