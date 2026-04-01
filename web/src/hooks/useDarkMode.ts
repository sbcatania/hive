"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "hive-dark-mode";

export function useDarkMode() {
  const [isDark, setIsDark] = useState(true);

  // Initialize from localStorage on mount.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const dark = saved === "true";
      setIsDark(dark);
      document.documentElement.classList.toggle("dark", dark);
    } else {
      // Default to dark mode.
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { isDark, toggle };
}
