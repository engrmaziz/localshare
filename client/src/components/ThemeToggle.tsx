import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyTheme,
  readTheme,
  resolvedDark,
  writeTheme,
  type Theme,
} from "../lib/theme.ts";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const dark = resolvedDark(theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function cycle() {
    const next: Theme =
      theme === "system" ? (dark ? "light" : "dark") : theme === "dark" ? "light" : "dark";
    writeTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
