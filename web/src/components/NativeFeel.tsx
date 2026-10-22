"use client";

import { useEffect } from "react";
import { screenCornerRadius, syncChrome } from "@/lib/theme-mode";
import { installTapHaptics } from "@/lib/haptics";

/** Small app-wide behaviours that make the site feel like a native app. */
export function NativeFeel() {
  useEffect(() => {
    // iOS only applies :active styles when a touch listener exists.
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    syncChrome();
    const r = screenCornerRadius();
    if (r !== null) document.documentElement.style.setProperty("--screen-r", `${r}px`);
    const offHaptics = installTapHaptics();
    // Cache the app (pages, scripts, the WASM engine) for instant, offline launches.
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      document.removeEventListener("touchstart", noop);
      offHaptics();
    };
  }, []);
  return null;
}
