"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "./Wordmark";
import { Icon } from "./Icon";
import { Avatar } from "./Nameplate";
import { Sheet } from "./Sheet";
import { NavIcon, type NavIconName } from "./NavIcons";
import { useAuth } from "@/lib/auth";
import { applyThemeMode, loadThemeMode, takeReopen, type ThemeMode } from "@/lib/theme-mode";

const NAV: { href: string; label: string; icon: NavIconName }[] = [
  { href: "/", label: "Play", icon: "play" },
  { href: "/learn", label: "Instructions", icon: "learn" },
  { href: "/puzzles", label: "Puzzles", icon: "puzzles" },
  { href: "/journal", label: "Your games", icon: "journal" },
  { href: "/leaderboard", label: "Rankings", icon: "rankings" },
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
  const opts: [ThemeMode, string, "sun" | "moon" | "auto"][] = [
    ["light", "Day", "sun"],
    ["dark", "Night", "moon"],
    ["system", "Auto", "auto"],
  ];
  return (
    <div className="seg">
      {opts.map(([m, n, icon]) => (
        <button
          key={m}
          aria-pressed={mode === m}
          className="inline-flex items-center gap-1.5"
          onClick={() => {
            setMode(m);
            applyThemeMode(m, { reopen: "menu" });
          }}
        >
          <Icon name={icon} size={17} />
          {n}
        </button>
      ))}
    </div>
  );
}

function AccountChip() {
  const { profile, user, loading } = useAuth();
  // While loading, hold exactly the Sign in button's space so nothing shifts.
  if (loading)
    return (
      <span className="btn-secondary invisible !min-h-10 !px-3 !py-0" aria-hidden>
        Sign in
      </span>
    );
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
  // A home-screen app relaunches to change its status bar with the theme; if that was
  // done from the menu, it comes back already open.
  const [reopened, setReopened] = useState(false);
  useEffect(() => {
    if (takeReopen() === "menu") {
      setReopened(true);
      setOpen(true);
    }
  }, []);
  // Close the menu when the page changes (not on first mount, which may be reopening it).
  const lastPath = useRef(path);
  useEffect(() => {
    if (lastPath.current !== path) setOpen(false);
    lastPath.current = path;
  }, [path]);
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/play") : path.startsWith(href));
  return (
    <header className="sticky top-0 z-30 h-[var(--header-h)] border-b-[1.5px] border-dashed border-line-strong bg-paper pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-3 sm:px-4">
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
          <AccountChip />
          <button className="icon-btn !h-10 !w-10 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
        </div>
      </div>
      <Sheet open={open} instant={reopened} onClose={() => (setOpen(false), setReopened(false))}>
        <nav className="grid gap-1 pb-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              prefetch={false}
              onClick={() => setOpen(false)}
              aria-current={active(n.href) ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 px-1 text-xl ${active(n.href) ? "font-bold text-ink" : "text-ink-soft"}`}
            >
              <NavIcon name={n.icon} />
              {n.label}
              {/* The current page: a honey hex at the end of its line. */}
              {active(n.href) && <span className="ml-auto h-[11px] w-[10px] shrink-0 bg-accent [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" aria-hidden />}
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
