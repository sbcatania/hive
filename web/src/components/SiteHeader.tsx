"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HiveMark } from "./HiveMark";
import { Icon } from "./Icon";
import { Avatar } from "./Nameplate";
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
      className="icon-btn !h-10 !w-10"
      title={label}
      aria-label={label}
      onClick={() => {
        const m = next[mode];
        setMode(m);
        applyThemeMode(m);
      }}
    >
      <Icon name={mode === "light" ? "sun" : mode === "dark" ? "moon" : "auto"} />
    </button>
  );
}

function AccountChip() {
  const { profile, user, loading } = useAuth();
  if (loading) return <div className="h-9 w-20" />;
  if (!user) {
    return (
      <Link href="/account" className="btn-secondary !min-h-10 !px-3 !py-0">
        Sign in
      </Link>
    );
  }
  return (
    <Link href="/account" className="sk flex h-10 items-center gap-2 border-[1.6px] border-line-strong bg-card px-2 text-sm hover:bg-card-2" title="Your account">
      <Avatar color="w" initial={(profile?.username ?? "?").slice(0, 1).toUpperCase()} size={26} />
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
    <header className="sticky top-0 z-30 border-b-[1.5px] border-dashed border-line-strong bg-paper/90 backdrop-blur-md">
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
              className={`px-2.5 py-1.5 text-[0.95rem] transition ${active(n.href) ? "scribble font-bold text-ink" : "text-ink-soft hover:text-ink"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <AccountChip />
          <button className="icon-btn !h-10 !w-10 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <nav className="grid gap-1 border-t border-line bg-paper px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`flex min-h-11 items-center px-3 text-lg ${active(n.href) ? "font-bold text-ink" : "text-ink-soft"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
