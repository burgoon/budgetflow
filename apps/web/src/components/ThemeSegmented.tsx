import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../themeContext";
import type { Theme } from "../lib/theme";

const OPTIONS: Array<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "auto", label: "Auto", Icon: Monitor },
];

/** Three-way theme picker — used in the More menu where we want all
 *  options visible at a glance, vs. the cycle button used in the desktop
 *  header where space is tight. */
export function ThemeSegmented() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="segmented theme-segmented" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          className={`segmented__option ${theme === value ? "segmented__option--active" : ""}`}
          onClick={() => setTheme(value)}
        >
          <Icon size={16} aria-hidden />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
