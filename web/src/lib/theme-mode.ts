export type ThemeMode = "system" | "light" | "dark";

const KEY = "hive.theme-mode";

export function loadThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "system";
}

/** Switches day/night. The change crossfades (a view transition where supported). A
 * home-screen app picks its status bar once, at launch, so if day/night actually
 * changed there it then relaunches (instant from the offline cache) behind a cover in
 * the new paper colour, reopening whatever `reopen` names (e.g. the menu). */
export function applyThemeMode(mode: ThemeMode, opts: { reopen?: string } = {}) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const next = dark ? "dark" : "light";
  const root = document.documentElement;
  const changed = root.dataset.theme !== next;
  const flip = () => {
    root.dataset.theme = next;
    window.dispatchEvent(new Event("hive-theme"));
    syncChrome();
  };
  const relaunch = () => {
    if (!changed || !isHomeScreenApp()) return;
    try {
      sessionStorage.setItem("hive.launched", "1");
      sessionStorage.setItem(COVER, "1");
      if (opts.reopen) sessionStorage.setItem(REOPEN, opts.reopen);
    } catch {}
    location.reload();
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
  if (changed && doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    doc.startViewTransition(flip).finished.then(relaunch, relaunch);
  } else {
    flip();
    relaunch();
  }
}

const COVER = "hive.theme-cover";
const REOPEN = "hive.reopen";

/** What to reopen after a theme relaunch (read once). */
export function takeReopen(): string | null {
  try {
    const v = sessionStorage.getItem(REOPEN);
    sessionStorage.removeItem(REOPEN);
    return v;
  } catch {
    return null;
  }
}

/** Running as an app added to the home screen (no browser UI). */
export function isHomeScreenApp() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Runs before first paint (inlined in <head>) to avoid a flash of the wrong theme.
 * It also picks the iOS home-screen status bar style, which iOS reads once at launch:
 * at night the page shows through behind white status text ("black-translucent"); by
 * day it's the standard white bar with dark text, which matches the white paper. */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem("${KEY}")||"system";var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";var s=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(!s){s=document.createElement("meta");s.name="apple-mobile-web-app-status-bar-style";document.head.appendChild(s);}s.content=d?"black-translucent":"default";if(sessionStorage.getItem("hive.launched"))document.documentElement.classList.add("relaunch");else sessionStorage.setItem("hive.launched","1");if(sessionStorage.getItem("${COVER}")){sessionStorage.removeItem("${COVER}");document.documentElement.classList.add("theme-cover");}}catch(e){document.documentElement.dataset.theme="light";}})();`;

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
