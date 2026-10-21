"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { haptic } from "@/lib/haptics";

// In-app replacements for window.confirm / alert. The browser versions show a system
// alert titled with the site's domain, which breaks the app feel (especially when the
// site runs from the home screen).

interface ConfirmOptions {
  title: string;
  message?: string;
  confirm: string;
  cancel?: string;
  danger?: boolean;
}

interface Dialogs {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  toast: (message: string) => void;
}

const Ctx = createContext<Dialogs>({ confirm: async () => false, toast: () => {} });

export function useDialogs() {
  return useContext(Ctx);
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [ask, setAsk] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setAsk(o);
    setOpen(true);
    return new Promise<boolean>((res) => (resolver.current = res));
  }, []);
  const finish = (v: boolean) => {
    setOpen(false);
    resolver.current?.(v);
    resolver.current = null;
  };
  const toast = useCallback((message: string) => {
    setNote(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 2800);
  }, []);

  return (
    <Ctx.Provider value={{ confirm, toast }}>
      {children}
      <Sheet open={open} onClose={() => finish(false)} title={ask?.title}>
        {ask?.message && <p className="text-ink-soft">{ask.message}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2 pb-1">
          <button className="btn-secondary" onClick={() => finish(false)}>
            {ask?.cancel ?? "Cancel"}
          </button>
          <button
            className={`btn ${ask?.danger ? "[--bc:var(--danger)] [--fill:var(--danger)] !text-paper" : ""}`}
            onClick={() => {
              haptic(true);
              finish(true);
            }}
          >
            {ask?.confirm}
          </button>
        </div>
      </Sheet>
      <div
        role="status"
        aria-live="polite"
        className={`pencil pencil-strong pointer-events-none fixed inset-x-4 z-[60] mx-auto max-w-sm px-4 py-3 text-center text-sm transition-all duration-300 [--fill:var(--card)] ${note ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
        style={{ bottom: "calc(max(env(safe-area-inset-bottom), 12px) + 72px)" }}
      >
        {note}
      </div>
    </Ctx.Provider>
  );
}
