"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/** Always the start screen: the current page may be a game that only lives on this device. */
function appLink() {
  return `${window.location.origin}/`;
}

/**
 * Sends a friend a link to the site: the phone's share sheet where there is one,
 * otherwise copies the link. Returns "copied" / "failed" for the caller to show.
 */
async function shareApp(): Promise<"shared" | "copied" | "failed" | "cancelled"> {
  const url = appLink();
  if (navigator.share) {
    try {
      await navigator.share({ title: "Hive", text: "Play Hive with me", url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // Some browsers expose share but refuse it (e.g. desktop without a target); copy instead.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

function useShare(onShared?: () => void) {
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const share = async () => {
    const r = await shareApp();
    if (r === "shared") onShared?.();
    if (r !== "copied" && r !== "failed") return;
    setNote(r === "copied" ? "Link copied" : "Couldn't copy the link");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 1800);
  };
  return { note, share };
}

/** A line in the menu sheet, under the pages. */
export function ShareRow({ onShared }: { onShared?: () => void }) {
  const { note, share } = useShare(onShared);
  return (
    <button type="button" onClick={share} className="flex min-h-12 w-full items-center gap-3 px-1 text-left text-xl text-ink-soft">
      <span className="grid h-7 w-7 shrink-0 place-items-center" aria-hidden>
        <Icon name={note === "Link copied" ? "check" : "share"} />
      </span>
      <span aria-live="polite">{note ?? "Share Hive with a friend"}</span>
    </button>
  );
}

/** The header button on wide screens, where there is no menu. */
export function ShareButton() {
  const { note, share } = useShare();
  return (
    <span className="relative">
      <button type="button" className="icon-btn !h-10 !w-10" aria-label="Share Hive with a friend" title="Share Hive" onClick={share}>
        <Icon name={note === "Link copied" ? "check" : "share"} />
      </button>
      {note && (
        <span role="status" className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-md border border-line bg-card px-2 py-1 text-sm text-ink shadow-sm">
          {note}
        </span>
      )}
    </span>
  );
}
