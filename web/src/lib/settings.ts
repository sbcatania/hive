// Remembers the start-screen choices between visits.
const PREFS_KEY = "hive.setup.v2";

export function loadSetupPrefs<T extends object>(fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveSetupPrefs(v: unknown) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(v));
  } catch {}
}

export const LOCAL_CLOCKS: { id: string; name: string; baseMs: number | null; incMs: number }[] = [
  { id: "none", name: "Untimed", baseMs: null, incMs: 0 },
  { id: "5+5", name: "5 + 5", baseMs: 5 * 60_000, incMs: 5000 },
  { id: "10+10", name: "10 + 10", baseMs: 10 * 60_000, incMs: 10_000 },
  { id: "20+20", name: "20 + 20", baseMs: 20 * 60_000, incMs: 20_000 },
];
