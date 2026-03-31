import { cleanTheme } from "./clean";
import { minimalTheme } from "./minimal";
import { polishedTheme } from "./polished";
import type { HiveTheme } from "./types";

export const THEMES: HiveTheme[] = [cleanTheme, minimalTheme, polishedTheme];

export function getTheme(id: string): HiveTheme {
  return THEMES.find((t) => t.id === id) || cleanTheme;
}

export function getSavedThemeId(): string {
  if (typeof window === "undefined") return "clean";
  return localStorage.getItem("hive-theme") || "clean";
}

export function saveThemeId(id: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("hive-theme", id);
  }
}

export type { HiveTheme } from "./types";
