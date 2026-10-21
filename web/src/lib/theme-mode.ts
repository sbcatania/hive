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

/** Runs before first paint (inlined in <head>) to avoid a flash of the wrong theme.
 * It also picks the iOS home-screen status bar style, which iOS reads once at launch:
 * at night the page shows through behind white status text ("black-translucent"); by
 * day it's the standard white bar with dark text, which matches the white paper. */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem("${KEY}")||"system";var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";var s=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(!s){s=document.createElement("meta");s.name="apple-mobile-web-app-status-bar-style";document.head.appendChild(s);}s.content=d?"black-translucent":"default";}catch(e){document.documentElement.dataset.theme="light";}})();`;

/** Current resolved theme ("light" | "dark"). */
export function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

const CHROME = { light: "#fafaf9", dark: "#17181a" } as const;

/** Colour the browser chrome (Safari's toolbar, Android's status bar) to match the
 * page's day/night setting, which can differ from the device's. */
export function syncChrome() {
  if (typeof document === "undefined") return;
  const color = CHROME[currentTheme()];
  if (!document.querySelector('meta[name="theme-color"]')) {
    const m = document.createElement("meta");
    m.name = "theme-color";
    document.head.append(m);
  }
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.removeAttribute("media");
    m.content = color;
  });
}
