"use client";

import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

/** The way back from a detail screen, at the top of the page's own content (not in the
 * header, which stays the same on every screen). A home-screen app has no browser back
 * button or swipe; with no history (opened from a link) it goes to `fallback`. */
export function BackBar({ fallback, label = "Back", className }: { fallback: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      className={`-ml-1.5 flex h-9 shrink-0 items-center gap-0.5 pr-2 text-[0.95rem] font-semibold text-ink-soft hover:text-ink ${className ?? ""}`}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      <Icon name="prev" size={20} />
      {label}
    </button>
  );
}
