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
  label.htmlFor = input.id;
  for (const el of [input, label]) {
    el.setAttribute("aria-hidden", "true");
    el.tabIndex = -1;
    Object.assign(el.style, { position: "fixed", left: "-9999px", top: "0", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
  }
  document.body.append(input, label);
  return label;
}

/** A light tap: selections, toggles. `strong` for a move landing or a game ending. */
export function haptic(strong = false) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(strong ? 18 : 8);
      return;
    }
    iosSwitch()?.click();
  } catch {}
}
