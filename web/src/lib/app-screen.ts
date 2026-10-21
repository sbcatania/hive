"use client";

import { useEffect } from "react";

/** Make this page a fixed, app-like screen (no page scroll, bounce or pull-to-refresh).
 * With `maxWidth`, only below that width (e.g. phones and tablets). */
export function useAppScreen(maxWidth?: number) {
  useEffect(() => {
    const root = document.documentElement;
    const mq = maxWidth ? window.matchMedia(`(max-width: ${maxWidth}px)`) : null;
    const apply = () => root.classList.toggle("app-screen", !mq || mq.matches);
    apply();
    mq?.addEventListener("change", apply);
    return () => {
      mq?.removeEventListener("change", apply);
      root.classList.remove("app-screen");
    };
  }, [maxWidth]);
}
