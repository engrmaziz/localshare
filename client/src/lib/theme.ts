const STORAGE_KEY = "localshare.theme";

export type Theme = "light" | "dark" | "system";

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* ignore */
  }
  return "system";
}

export function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolvedDark(theme: Theme = readTheme()): boolean {
  return theme === "dark" || (theme === "system" && prefersDark());
}

export function applyTheme(theme: Theme = readTheme()): void {
  const dark = resolvedDark(theme);
  document.documentElement.classList.toggle("dark", dark);
  const color = dark ? "#0d1014" : "#f3efe6";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", color);
}

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
}
