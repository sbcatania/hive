"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HiveMark } from "./HiveMark";
import { useAuth } from "@/lib/auth";
import { applyThemeMode, loadThemeMode, type ThemeMode } from "@/lib/theme-mode";

const NAV = [
  { href: "/", label: "Play" },
  { href: "/learn", label: "Field guide" },
  { href: "/puzzles", label: "Puzzles" },
  { href: "/journal", label: "Journal" },
  { href: "/leaderboard", label: "Rankings" },
];

function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    setMode(loadThemeMode());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => loadThemeMode() === "system" && applyThemeMode("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const next: Record<ThemeMode, ThemeMode> = { system: "light", light: "dark", dark: "system" };
  const label = { system: "Theme: follows your device", light: "Theme: day", dark: "Theme: night" }[mode];
  return (
    <button
      className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-card text-ink-soft transition hover:text-ink"
      title={label}
      aria-label={label}
      onClick={() => {
        const m = next[mode];
        setMode(m);
        applyThemeMode(m);
      }}
    >
      {mode === "light" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4.5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="12" y1="2.5" x2="12" y2="5" transform={`rotate(${a} 12 12)`} strokeLinecap="round" />
          ))}
        </svg>
      ) : mode === "dark" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
          <circle cx="17" cy="6" r="1" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

function AccountChip() {
  const { profile, user, loading } = useAuth();
  if (loading) return <div className="h-9 w-20" />;
  if (!user) {
    return (
      <Link href="/account" className="btn-secondary h-9 px-3 py-0">
        Sign in
      </Link>
    );
  }
  return (
    <Link href="/account" className="flex h-9 items-center gap-2 rounded-xl border border-line bg-card px-2.5 text-sm hover:bg-card-2" title="Your account">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-xs font-bold text-accent-ink">{(profile?.username ?? "?").slice(0, 1).toUpperCase()}</span>
      <span className="hidden max-w-28 truncate font-medium sm:inline">{profile?.username ?? "Account"}</span>
      {profile && profile.rated_games > 0 && <span className="font-mono text-xs text-muted">{profile.rating}</span>}
    </Link>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Hive home">
          <HiveMark className="h-8 w-8" />
          <span className="font-display text-xl font-semibold tracking-tight">Hive</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${active(n.href) ? "bg-card font-semibold text-ink shadow-sm ring-1 ring-line" : "text-ink-soft hover:text-ink"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <AccountChip />
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-card md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="grid gap-1 border-t border-line bg-paper px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`rounded-lg px-3 py-2 ${active(n.href) ? "bg-card font-semibold" : "text-ink-soft"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
