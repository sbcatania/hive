"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { haptic } from "@/lib/haptics";

// iOS's sheet curve (fast out, long gentle settle), used for opening, closing and
// snapping back after a drag.
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** A bottom sheet for phones, shaped and moving like a native iOS sheet: rounded top
 * that meets the rounded screen, the sides and bottom running off the screen edges,
 * the iOS drawer curve, drag down (or flick) to dismiss, and a little resistance when
 * pulled up. Closes on the backdrop, the close button or Escape. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const g = useRef<{ y: number; t: number; lastY: number; lastT: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Keep the content while the sheet slides away, so it doesn't close empty.
  const [live, setLive] = useState(open);
  useEffect(() => {
    if (open) return setLive(true);
    const t = setTimeout(() => setLive(false), 500);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    setDrag(0);
    haptic();
    // Content pages: stop the page behind from scrolling while the sheet is up.
    document.documentElement.classList.add("sheet-open");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("sheet-open");
    };
  }, [open, onClose]);
  if (!mounted) return null;

  // Drag from the grabber or the title area.
  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as Element).closest("button")) return;
      g.current = { y: e.clientY, t: e.timeStamp, lastY: e.clientY, lastT: e.timeStamp };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      setDragging(true);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = g.current;
      if (!s) return;
      const dy = e.clientY - s.y;
      // Down follows the finger; up resists, like pulling a sheet past its detent.
      setDrag(dy >= 0 ? dy : -Math.sqrt(-dy) * 2.2);
      s.lastY = e.clientY;
      s.lastT = e.timeStamp;
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = g.current;
      g.current = null;
      setDragging(false);
      if (!s) return;
      const height = panel.current?.offsetHeight ?? 400;
      const velocity = (e.clientY - s.lastY) / Math.max(1, e.timeStamp - s.lastT);
      if (drag > height * 0.3 || (velocity > 0.45 && drag > 12)) onClose();
      else setDrag(0);
    },
    onPointerCancel: () => {
      g.current = null;
      setDragging(false);
      setDrag(0);
    },
  };

  const offset = open ? Math.max(drag, -24) : null;
  return createPortal(
    <div
      className={`fixed inset-0 z-50 overflow-hidden ${open ? "visible" : "pointer-events-none invisible"}`}
      style={{ transition: `visibility 0s linear ${open ? "0s" : "500ms"}` }}
      aria-hidden={!open}
    >
      {/* The dim stops at the header: in a home-screen app the status bar can't dim with the
          page, so the header (which sits under it) stays bright too and the two always match. */}
      <div
        className="absolute inset-x-0 top-[var(--header-h)] bottom-0 touch-none bg-black/35"
        style={{ opacity: open ? Math.max(0, 1 - drag / 500) : 0, transition: dragging ? "none" : `opacity 500ms ${EASE}` }}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-panel absolute inset-x-0 bottom-0 flex max-h-[calc(100dvh-var(--header-h)-12px)] flex-col"
        style={{
          transform: offset === null ? "translateY(calc(100% + 40px))" : `translateY(${offset}px)`,
          transition: dragging ? "none" : `transform 500ms ${EASE}`,
          paddingBottom: "max(env(safe-area-inset-bottom), 14px)",
        }}
      >
        <div className="shrink-0 touch-none select-none" {...handle}>
          <div className="flex items-center justify-between px-3 pt-2">
            <span className="w-10" />
            <span className="h-[5px] w-10 rounded-full bg-line-strong/70" />
            <button className="grid h-10 w-10 place-items-center text-ink-soft" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          {title && <div className="px-6 pb-2 font-display text-xl font-semibold">{title}</div>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-2">{live && children}</div>
      </div>
    </div>,
    document.body,
  );
}
