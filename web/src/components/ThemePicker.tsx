"use client";

import { THEMES, type ThemeId } from "@/lib/themes";

export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (t: ThemeId) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--panel)] p-0.5 text-xs">
      {THEMES.map((t) => (
        <button
          key={t.id}
          title={t.blurb}
          onClick={() => onChange(t.id)}
          className={`rounded-md px-2 py-1 ${value === t.id ? "bg-amber-500 text-white" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
