"use client";

// Haptic feedback. Android exposes navigator.vibrate. iOS Safari doesn't, but since
// iOS 18 toggling a native <input type="checkbox" switch> plays the system "tick", so
// we keep a hidden switch and click its label. Must run inside a user gesture.

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

/** Every press of a control gives a tick, app-wide (installed once, see NativeFeel). */
export function installTapHaptics() {
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
