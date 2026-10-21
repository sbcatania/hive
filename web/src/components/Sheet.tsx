"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { haptic } from "@/lib/haptics";
import { syncChrome } from "@/lib/theme-mode";

/** A bottom sheet for phones: slides up over the screen, closes on the backdrop,
 * the close button, Escape, or by dragging the handle down. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    setDrag(0);
    syncChrome(true);
    haptic();
    // Content pages: stop the page behind from scrolling while the sheet is up.
    document.documentElement.classList.add("sheet-open");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      syncChrome(false);
      document.documentElement.classList.remove("sheet-open");
    };
  }, [open, onClose]);
  if (!mounted) return null;

  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = e.clientY;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => start.current !== null && setDrag(Math.max(0, e.clientY - start.current)),
    onPointerUp: () => {
      if (drag > 80) onClose();
      setDrag(0);
      start.current = null;
    },
  };

  return createPortal(
    <div className={`fixed inset-0 z-50 overflow-hidden transition-[visibility] duration-300 ${open ? "visible" : "pointer-events-none invisible"}`} aria-hidden={!open}>
      <div className={`absolute inset-0 touch-none bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pencil absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col [--br:22px_22px_0_0/22px_22px_0_0] [--bc:var(--ink-soft)] [--fill:var(--paper)]"
        style={{
          transform: open ? `translateY(${drag}px)` : "translateY(105%)",
          transition: start.current !== null ? "none" : "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
        }}
      >
        <div className="flex shrink-0 touch-none items-center justify-between px-4 pt-2 pb-1" {...handle}>
          <span className="w-10" />
          <span className="h-1.5 w-12 rounded-full bg-line-strong/60" />
          <button className="grid h-10 w-10 place-items-center text-ink-soft" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {title && <div className="shrink-0 px-5 pb-2 font-display text-xl font-semibold">{title}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">{open && children}</div>
      </div>
    </div>,
    document.body,
  );
}
