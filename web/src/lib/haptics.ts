"use client";

// Haptic feedback. Android exposes navigator.vibrate. iOS Safari doesn't, but toggling
// a native <input type="checkbox" switch> plays the system tick. Up to iOS 26.4 a
// script could click a hidden switch's label inside a tap; since 26.5 the finger has
// to toggle a real switch itself, so on iPhones every control carries an invisible
// switch over it (installSwitchOverlays) and the tap is passed on to the control.

let label: HTMLLabelElement | null = null;

function iosSwitch(): HTMLLabelElement | null {
  if (label) return label;
  if (typeof document === "undefined") return null;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.id = "haptic-switch";
  label = document.createElement("label");
  label.id = "haptic-label";
  label.htmlFor = input.id;
  for (const el of [input, label]) {
    el.setAttribute("aria-hidden", "true");
    el.tabIndex = -1;
    Object.assign(el.style, { position: "fixed", left: "-9999px", top: "0", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
  }
  document.body.append(input, label);
  return label;
}

let last = 0;

/** A light tap: selections, toggles. `strong` for a move landing or a game ending.
 * Calls within 60ms of each other collapse into one. */
export function haptic(strong = false) {
  const now = performance.now();
  if (now - last < 60) return;
  last = now;
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(strong ? 18 : 8);
      return;
    }
    iosSwitch()?.click();
  } catch {}
}

const HOSTS = 'button, a[href], summary, [role="button"], label:has(input[type="checkbox"])';

/** iPhone-style haptics: a native switch is the only thing that can tick, and only
 * under a finger. Touch devices without navigator.vibrate but with switch support. */
function wantsSwitchOverlays() {
  return typeof window !== "undefined" && !("vibrate" in navigator) && "switch" in HTMLInputElement.prototype && window.matchMedia("(pointer: coarse)").matches;
}

function overlay(host: Element) {
  if (!(host instanceof HTMLElement) || host.closest("[data-no-haptic]")) return;
  if (host.querySelector(":scope > .haptic-switch")) return;
  // Only the innermost control gets one, so it is the one under the finger.
  if (host.querySelector(HOSTS)) return;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  const sw = document.createElement("input");
  sw.type = "checkbox";
  sw.setAttribute("switch", "");
  sw.className = "haptic-switch";
  sw.tabIndex = -1;
  sw.setAttribute("aria-hidden", "true");
  // The switch has ticked; hand the tap to the control it covers (a real click, so
  // links navigate, labels toggle their input and forms submit) and swallow its own.
  // A touch that turned into a scroll is not a press (see `gesture`).
  sw.addEventListener("click", (e) => {
    e.stopPropagation();
    if (gesture.scrolled) {
      e.preventDefault(); // undo the toggle
      return;
    }
    host.click();
  });
  host.append(sw);
}

/** The current touch, so a scroll is never mistaken for a press. iOS switches respond to
 * a finger sliding across them, not only to taps, so a scroll that starts on a control
 * could flip its switch and press the control. A touch counts as a scroll once the
 * finger moves more than a few pixels or anything scrolls; the switch under it is then
 * disabled for the rest of the touch (no flip, no tick). A touch that lands while a
 * list is still gliding from a flick just stops it, as in native lists. */
const gesture = { x: 0, y: 0, scrolled: false, sw: null as HTMLInputElement | null };
let lastScroll = 0;
const benched = new Set<HTMLInputElement>();

function trackGestures() {
  const release = () => {
    benched.forEach((sw) => (sw.disabled = false));
    benched.clear();
  };
  // Re-enable just after the finger lifts (once the cancelled touch can no longer
  // toggle), or at once when the next touch begins, so a quick second tap never waits.
  const settle = () => {
    if (benched.size) setTimeout(release, 80);
  };
  const cancel = () => {
    gesture.scrolled = true;
    if (gesture.sw) {
      gesture.sw.disabled = true;
      benched.add(gesture.sw);
    }
  };
  const onStart = (e: TouchEvent) => {
    release();
    const t = e.touches[0];
    gesture.x = t.clientX;
    gesture.y = t.clientY;
    gesture.sw = e.target instanceof HTMLInputElement && e.target.classList.contains("haptic-switch") ? e.target : null;
    gesture.scrolled = false;
    if (performance.now() - lastScroll < 120) cancel();
  };
  const onMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!gesture.scrolled && Math.hypot(t.clientX - gesture.x, t.clientY - gesture.y) > 8) cancel();
  };
  const onScroll = () => {
    lastScroll = performance.now();
    if (gesture.sw) cancel();
  };
  document.addEventListener("touchstart", onStart, { capture: true, passive: true });
  document.addEventListener("touchmove", onMove, { capture: true, passive: true });
  document.addEventListener("touchend", settle, { capture: true, passive: true });
  document.addEventListener("touchcancel", settle, { capture: true, passive: true });
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  return () => {
    document.removeEventListener("touchstart", onStart, { capture: true });
    document.removeEventListener("touchmove", onMove, { capture: true });
    document.removeEventListener("touchend", settle, { capture: true });
    document.removeEventListener("touchcancel", settle, { capture: true });
    document.removeEventListener("scroll", onScroll, { capture: true });
  };
}

/** Puts an invisible native switch inside every tappable control, now and as the page
 * changes (React may also wipe one when it rewrites a control's text). */
function installSwitchOverlays() {
  const offGestures = trackGestures();
  document.querySelectorAll(HOSTS).forEach(overlay);
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (!(n instanceof Element) || n.classList.contains("haptic-switch")) return;
        const inner = n.matches(HOSTS) ? [n, ...n.querySelectorAll(HOSTS)] : [...n.querySelectorAll(HOSTS)];
        if (!inner.length) return;
        inner.forEach(overlay);
        // A control added inside another means the outer one mustn't cover it.
        n.parentElement?.closest(HOSTS)?.querySelector(":scope > .haptic-switch")?.remove();
      });
      const host = r.target instanceof Element ? r.target.closest(HOSTS) : null;
      if (host) overlay(host);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
  return () => {
    mo.disconnect();
    offGestures();
  };
}

/** Every press of a control gives a tick, app-wide (installed once, see NativeFeel). */
export function installTapHaptics() {
  if (wantsSwitchOverlays()) return installSwitchOverlays();
  const onClick = (e: MouseEvent) => {
    const t = e.target as Element | null;
    if (!t || (t as HTMLElement).id === "haptic-label" || (t as HTMLElement).id === "haptic-switch") return;
    const el = t.closest("button, a[href], [role=button], summary, label, input, select");
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
    haptic();
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
