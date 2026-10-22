"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

// iOS's sheet curve (fast out, long gentle settle).
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const DURATION = 480;

/** A bottom sheet that floats like an iOS 26 sheet: inset from the screen edges with
 * corners concentric to the rounded screen. Drag it from anywhere: pulling down on its
 * content (once scrolled to the top) or its header moves the sheet, a flick or a long
 * pull dismisses it, and pulling up rubber-bands. Dragging writes the transform
 * straight to the element (no React renders), so it tracks the finger at frame rate.
 * Closes on the backdrop, the close button or Escape. */
export function Sheet({ open, onClose, title, children, instant }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; /** Appear already open, without sliding up. */ instant?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [live, setLive] = useState(open);
  const panel = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) return setLive(true);
    const t = setTimeout(() => setLive(false), DURATION);
    return () => clearTimeout(t);
  }, [open]);

  // The panel's height, measured when a drag starts: reading it on every frame right
  // after writing styles would force a style recalculation each time.
  const height = useRef(0);
  const place = (y: number | null, animate: boolean) => {
    const p = panel.current;
    const d = dim.current;
    if (!p || !d) return;
    const h = animate || !height.current ? p.offsetHeight || 400 : height.current;
    const t = animate ? `transform ${DURATION}ms ${EASE}` : "none";
    p.style.transition = t;
    d.style.transition = animate ? `opacity ${DURATION}ms ${EASE}` : "none";
    p.style.transform = y === null ? "translate3d(0, calc(100% + 24px), 0)" : `translate3d(0, ${y}px, 0)`;
    d.style.opacity = y === null ? "0" : String(Math.max(0, 1 - Math.max(0, y) / h));
  };

  // Open / close.
  useLayoutEffect(() => {
    if (!mounted) return;
    if (open) {
      if (instant) return place(0, false);
      place(null, false);
      // Next frame: slide up.
      const id = requestAnimationFrame(() => requestAnimationFrame(() => place(0, true)));
      return () => cancelAnimationFrame(id);
    }
    place(null, true);
  }, [open, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Touch dragging from anywhere on the sheet.
  useEffect(() => {
    const p = panel.current;
    if (!p || !open) return;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;
    let mode: "idle" | "undecided" | "drag" | "scroll" = "idle";
    let y = 0;
    let frame = 0;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startY = lastY = e.touches[0].clientY;
      height.current = p.offsetHeight || 400;
      lastT = e.timeStamp;
      vel = 0;
      mode = "undecided";
    };
    const onMove = (e: TouchEvent) => {
      if (mode === "idle" || mode === "scroll") return;
      const cy = e.touches[0].clientY;
      const dy = cy - startY;
      const sc = scroller.current;
      const inScroller = !!sc && sc.contains(e.target as Node);
      const canScroll = !!sc && sc.scrollHeight > sc.clientHeight + 1;
      if (mode === "undecided") {
        if (Math.abs(dy) < 4) return;
        // Down from the top of the content, or anywhere outside it, drags the sheet;
        // otherwise the content scrolls as usual.
        if (inScroller && canScroll && (dy < 0 || sc!.scrollTop > 0)) {
          mode = "scroll";
          return;
        }
        // Measure from where the finger landed, so the sheet sits under it rather
        // than trailing by the distance it took to decide.
        mode = "drag";
      }
      e.preventDefault();
      const d = cy - startY;
      y = d >= 0 ? d : -Math.sqrt(-d) * 2.2;
      const dt = Math.max(1, e.timeStamp - lastT);
      vel = 0.7 * vel + 0.3 * ((cy - lastY) / dt);
      lastY = cy;
      lastT = e.timeStamp;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => place(y, false));
    };
    const onEnd = () => {
      if (mode !== "drag") {
        mode = "idle";
        return;
      }
      mode = "idle";
      cancelAnimationFrame(frame);
      const h = height.current;
      if (y > h * 0.3 || (vel > 0.5 && y > 10)) closeRef.current();
      else place(0, true);
      y = 0;
    };
    p.addEventListener("touchstart", onStart, { passive: true });
    p.addEventListener("touchmove", onMove, { passive: false });
    p.addEventListener("touchend", onEnd);
    p.addEventListener("touchcancel", onEnd);
    return () => {
      p.removeEventListener("touchstart", onStart);
      p.removeEventListener("touchmove", onMove);
      p.removeEventListener("touchend", onEnd);
      p.removeEventListener("touchcancel", onEnd);
      cancelAnimationFrame(frame);
    };
  }, [open, live]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;
  return createPortal(
    <div className={`fixed inset-0 z-50 overflow-hidden ${open ? "visible" : "pointer-events-none invisible"}`} style={{ transition: `visibility 0s linear ${open ? "0s" : `${DURATION}ms`}` }} aria-hidden={!open}>
      {/* The dim stops at the header: in a home-screen app the status bar can't dim with the
          page, so the header (which sits under it) stays bright too and the two always match. */}
      <div ref={dim} className="absolute inset-x-0 top-[var(--header-h)] bottom-0 touch-none bg-black/35" style={{ opacity: 0 }} onClick={() => closeRef.current()} />
      {/* Undimmed, but still part of the backdrop: a drag here mustn't scroll the page. */}
      <div className="absolute inset-x-0 top-0 h-[var(--header-h)] touch-none" onClick={() => closeRef.current()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-panel absolute flex max-h-[calc(100dvh-var(--header-h)-16px)] flex-col overscroll-contain"
        style={{ transform: "translate3d(0, calc(100% + 24px), 0)" }}
      >
        <div className="shrink-0 select-none">
          <div className="flex items-center justify-between px-3 pt-2">
            <span className="w-10" />
            <svg viewBox="0 0 40 6" className="h-1.5 w-10 text-line-strong" aria-hidden>
              <path d="M3 3.4C12 2.4 27 2.6 37 3" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
            </svg>
            <button className="grid h-10 w-10 place-items-center text-ink-soft" onClick={() => closeRef.current()} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          {title && <div className="px-6 pb-2 font-display text-xl font-semibold">{title}</div>}
        </div>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4">
          {/* Rendered in the same frame the sheet opens, so it slides up at full height
              (rendering a frame later made a short, too-quick slide and then a jump). */}
          {(live || open) && children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
