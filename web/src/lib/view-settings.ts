"use client";

import { useEffect, useState } from "react";

export interface ViewSettings {
  /** Tapping an opponent's piece shows where it can go (on their turn) or could go next. */
  opponentMoves: boolean;
}

const KEY = "hive.view.v1";
const DEFAULTS: ViewSettings = { opponentMoves: true };

function load(): ViewSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

/** View preferences, remembered in this browser and shared by every open game. */
export function useViewSettings(): [ViewSettings, (patch: Partial<ViewSettings>) => void] {
  const [v, setV] = useState<ViewSettings>(DEFAULTS);
  useEffect(() => {
    setV(load());
    const on = () => setV(load());
    window.addEventListener("hive-view", on);
    return () => window.removeEventListener("hive-view", on);
  }, []);
  const update = (patch: Partial<ViewSettings>) => {
    const next = { ...load(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    setV(next);
    window.dispatchEvent(new Event("hive-view"));
  };
  return [v, update];
}
