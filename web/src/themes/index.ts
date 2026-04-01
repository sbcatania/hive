import { natureTheme } from "./clean";
import { arcticTheme } from "./minimal";
import { emberTheme } from "./polished";
import { retroTheme } from "./retro";
import type { HiveTheme } from "./types";

export const THEMES: HiveTheme[] = [natureTheme, arcticTheme, emberTheme, retroTheme];

export function getTheme(id: string): HiveTheme {
  return THEMES.find((t) => t.id === id) || natureTheme;
}

export function getSavedThemeId(): string {
  if (typeof window === "undefined") return "nature";
  const saved = localStorage.getItem("hive-theme");
  // Migrate old theme IDs to new ones
  if (saved === "clean") return "nature";
  if (saved === "minimal") return "arctic";
  if (saved === "polished") return "ember";
  return saved || "nature";
}

export function saveThemeId(id: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("hive-theme", id);
  }
}

export type { HiveTheme } from "./types";
