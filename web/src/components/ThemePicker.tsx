"use client";

import { THEMES, type ThemeId } from "@/lib/themes";

export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (t: ThemeId) => void }) {
  return (
    <div className="seg text-xs">
      {THEMES.map((t) => (
        <button key={t.id} aria-label={`${t.name}: ${t.blurb}`} aria-pressed={value === t.id} onClick={() => onChange(t.id)} className="!px-2 !py-1">
          {t.name}
        </button>
      ))}
    </div>
  );
}
