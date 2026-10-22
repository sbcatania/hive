"use client";

import { useEffect } from "react";

/** Phones in either orientation (matches the `phone:` Tailwind variant). */
export const PHONE_QUERY = "(max-width: 639px), (orientation: landscape) and (max-height: 540px)";

/** Make this page a fixed, app-like screen (no page scroll, bounce or pull-to-refresh).
 * With `when` (a max width in px, or a media query), only while it matches. */
export function useAppScreen(when?: number | string) {
  useEffect(() => {
    const root = document.documentElement;
    const mq = when ? window.matchMedia(typeof when === "number" ? `(max-width: ${when}px)` : when) : null;
    const apply = () => root.classList.toggle("app-screen", !mq || mq.matches);
    apply();
    mq?.addEventListener("change", apply);
    return () => {
      mq?.removeEventListener("change", apply);
      root.classList.remove("app-screen");
    };
  }, [when]);
}
