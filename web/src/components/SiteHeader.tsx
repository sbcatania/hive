"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "./Wordmark";
import { Icon } from "./Icon";
import { Avatar } from "./Nameplate";
import { Sheet } from "./Sheet";
import { useAuth } from "@/lib/auth";
import { applyThemeMode, loadThemeMode, type ThemeMode } from "@/lib/theme-mode";

const DETAIL = ["/replay", "/player", "/account"];

const NAV = [
  { href: "/", label: "Play" },
  { href: "/learn", label: "How to play" },
  { href: "/puzzles", label: "Puzzles" },
  { href: "/journal", label: "Your games" },
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

/** Day / night / auto as a segmented control, for the menu sheet where there's room. */
function ThemeSeg() {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => setMode(loadThemeMode()), []);
  const opts: [ThemeMode, string][] = [
    ["light", "Day"],
    ["dark", "Night"],
    ["system", "Auto"],
  ];
  return (
    <div className="seg">
      {opts.map(([m, n]) => (
        <button
          key={m}
          aria-pressed={mode === m}
          onClick={() => {
            setMode(m);
            applyThemeMode(m);
          }}
        >
          {n}
        </button>
      ))}
    </div>
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
    <Link href="/account" className="pencil flex h-10 items-center gap-2 px-2 text-sm" aria-label="Your account">
      <Avatar color="w" initial={(profile?.username ?? "?").slice(0, 1).toUpperCase()} size={26} />
      <span className="hidden max-w-28 truncate font-medium sm:inline">{profile?.username ?? "Account"}</span>
      {profile && profile.rated_games > 0 && <span className="text-xs text-muted tabular-nums">{profile.rating}</span>}
    </Link>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/play") : path.startsWith(href));
  const router = useRouter();
  // Detail screens get a back button: there's no browser back button or swipe in a
  // home-screen app. With no history (opened from a link), go to the parent list.
  const back = () => (window.history.length > 1 ? router.back() : router.push(path.startsWith("/player") ? "/leaderboard" : "/journal"));
  return (
    <header className="sticky top-0 z-30 h-[var(--header-h)] border-b-[1.5px] border-dashed border-line-strong bg-paper pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-3 sm:px-4">
        {DETAIL.some((d) => path.startsWith(d)) && (
          <button className="icon-btn -mr-1 !h-10 !w-10 [--bc:transparent] [--fill:transparent]" onClick={back} aria-label="Back">
            <Icon name="prev" />
          </button>
        )}
        <Link href="/" className="flex items-center" aria-label="Hive home">
          <Wordmark className="h-11 w-auto sm:h-12" />
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-link px-2.5 py-1.5 text-[0.95rem] transition ${active(n.href) ? "font-bold text-ink" : "text-ink-soft hover:text-ink"}`}
              aria-current={active(n.href) ? "page" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:block">
            <ThemeToggle />
          </span>
          {!path.startsWith("/account") && <AccountChip />}
          <button className="icon-btn !h-10 !w-10 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <nav className="grid gap-1 pb-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              aria-current={active(n.href) ? "page" : undefined}
              className={`flex min-h-12 items-center px-1 text-xl ${active(n.href) ? "font-bold text-ink" : "text-ink-soft"}`}
            >
              <span className="nav-link">{n.label}</span>
            </Link>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-dashed border-line-strong pt-3">
            <span className="text-ink-soft">Theme</span>
            <ThemeSeg />
          </div>
        </nav>
      </Sheet>
    </header>
  );
}
