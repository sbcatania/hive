export type ThemeMode = "system" | "light" | "dark";

const KEY = "hive.theme-mode";

export function loadThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "system";
}

export function applyThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  window.dispatchEvent(new Event("hive-theme"));
  syncChrome();
}

/** Runs before first paint (inlined in <head>) to avoid a flash of the wrong theme. */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem("${KEY}")||"system";var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

/** Current resolved theme ("light" | "dark"). */
export function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

const CHROME = { light: ["#fafaf9", "#959595"], dark: ["#17181a", "#0d0e0f"] } as const;

/** Colour the browser / home-screen app status bar to match the page; `dimmed` while a
 * sheet's backdrop covers the page, so the status bar dims with it. */
export function syncChrome(dimmed = false) {
  if (typeof document === "undefined") return;
  const color = CHROME[currentTheme()][dimmed ? 1 : 0];
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const m = document.createElement("meta");
    m.name = "theme-color";
    document.head.append(m);
  }
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.removeAttribute("media");
    m.content = color;
  });
}
