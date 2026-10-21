"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdvancedRules, ExpansionToggles } from "@/components/RulesEditor";
import { Wordmark } from "@/components/Wordmark";
import { Sheet } from "@/components/Sheet";
import { describeVariants } from "@/lib/variants";
import { Icon, type IconName } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/engine";
import { isStandardRules, levelInfo, LEVELS, normalizeRules, standardRules, type ColorCode, type Level, type Rules } from "@/lib/engine-types";
import { gameTitle, listLocal, migrateLegacySave, newId, resultLabel, resumable, saveLocal, setCurrentGameId, type JournalEntry } from "@/lib/journal";
import { createOnlineGame, onlineAvailable, TIME_CONTROLS } from "@/lib/online";
import { LOCAL_CLOCKS, loadSetupPrefs, saveSetupPrefs } from "@/lib/settings";

type Mode = "cpu" | "local" | "online";

interface Prefs {
  mode: Mode;
  rules: Rules;
  level: Level;
  color: ColorCode | "random";
  localClock: string;
  onlineClock: string;
  rated: boolean;
}

const DEFAULT_PREFS: Prefs = { mode: "cpu", rules: standardRules(), level: "medium", color: "w", localClock: "none", onlineClock: "none", rated: false };

const MODES: { id: Mode; icon: IconName; title: string; text: string }[] = [
  { id: "cpu", icon: "bolt", title: "Computer", text: "Four difficulty levels" },
  { id: "local", icon: "hexes", title: "Same device", text: "Two players, one screen" },
  { id: "online", icon: "link", title: "Online", text: "Send a friend a link" },
];

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [resume, setResume] = useState<JournalEntry | null>(null);
  const [recent, setRecent] = useState<JournalEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState(false);

  useEffect(() => {
    migrateLegacySave();
    const p = loadSetupPrefs(DEFAULT_PREFS);
    setPrefs({ ...p, rules: normalizeRules(p.rules) });
    setResume(resumable());
    setRecent(listLocal().filter((e) => e.result).slice(0, 3));
  }, []);

  function update(p: Partial<Prefs>) {
    const next = { ...prefs, ...p };
    setPrefs(next);
    saveSetupPrefs(next);
  }

  const variant = !isStandardRules(prefs.rules);
  const ratedAllowed = !!user && !variant;

  async function start() {
    setError(null);
    const color: ColorCode = prefs.color === "random" ? (Math.random() < 0.5 ? "w" : "b") : prefs.color;
    if (prefs.mode === "online") {
      setBusy(true);
      try {
        const { id } = await createOnlineGame(prefs.rules, color, prefs.onlineClock, prefs.rated && ratedAllowed);
        router.push(`/online?g=${id}`);
      } catch (e) {
        setError(errorMessage(e));
        setBusy(false);
      }
      return;
    }
    const clock = LOCAL_CLOCKS.find((c) => c.id === prefs.localClock) ?? LOCAL_CLOCKS[0];
    const now = Date.now();
    const entry: JournalEntry = {
      id: newId(),
      mode: prefs.mode,
      rules: prefs.rules,
      moves: [],
      label: prefs.mode === "cpu" ? `vs Computer (${levelInfo(prefs.level).name})` : "Pass & play",
      human: prefs.mode === "cpu" ? color : "w",
      level: prefs.mode === "cpu" ? prefs.level : undefined,
      clock: clock.baseMs ? { baseMs: clock.baseMs, incMs: clock.incMs } : undefined,
      createdAt: now,
      updatedAt: now,
    };
    saveLocal(entry);
    setCurrentGameId(entry.id);
    router.push(`/play?id=${entry.id}`);
  }

  const lvl = levelInfo(prefs.level);
  const startLabel = busy ? "Creating game…" : prefs.mode === "online" ? "Create game & get link" : "Start game";

  const clocks = prefs.mode === "online" ? TIME_CONTROLS : LOCAL_CLOCKS;
  const clockKey = prefs.mode === "online" ? "onlineClock" : "localClock";
  const clockName = clocks.find((c) => c.id === prefs[clockKey])?.name ?? "Untimed";
  const variantCount = describeVariants(prefs.rules).length;
  const expCount = [prefs.rules.mosquito, prefs.rules.ladybug, prefs.rules.pillbug].filter(Boolean).length;
  const optionsSummary = [clockName, expCount === 3 ? "all expansions" : expCount === 0 ? "base game" : `${expCount} expansion${expCount === 1 ? "" : "s"}`, variantCount ? `${variantCount} variant${variantCount === 1 ? "" : "s"}` : null, prefs.mode === "online" && prefs.rated && ratedAllowed ? "Rated" : null]
    .filter(Boolean)
    .join(", ");

  const clockPicker = (
    <div>
      <span className="label">Clock</span>
      <div className="seg">
        {clocks.map((tc) => (
          <button key={tc.id} aria-pressed={prefs[clockKey] === tc.id} onClick={() => update({ [clockKey]: tc.id } as Partial<Prefs>)}>
            {tc.name}
          </button>
        ))}
      </div>
    </div>
  );
  const ratedToggle = prefs.mode === "online" && (
    <label className={`flex items-start gap-3 text-sm ${ratedAllowed ? "cursor-pointer" : "opacity-60"}`}>
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--ink)]" disabled={!ratedAllowed} checked={prefs.rated && ratedAllowed} onChange={(e) => update({ rated: e.target.checked })} />
      <span>
        <span className="font-semibold">Rated</span>
        <span className="block text-xs text-muted">
          {!user ? (
            <>
              <Link href="/account" className="underline">
                Sign in
              </Link>{" "}
              to play rated games.
            </>
          ) : variant ? (
            "Rated games use the official rules."
          ) : (
            "Both players need an account. Ratings start at 1200."
          )}
        </span>
      </span>
    </label>
  );
  const expansions = (
    <div>
      <span className="label">Expansion bugs</span>
      <ExpansionToggles rules={prefs.rules} onChange={(rules) => update({ rules })} />
    </div>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-4 max-sm:min-h-[calc(100dvh-var(--header-h))] sm:pb-16">
      <section className="pt-3 pb-1 [@media(max-height:620px)]:pt-1.5 sm:pt-8 sm:pb-2 md:pt-12">
        <div className="flex items-end justify-between gap-3 sm:items-center sm:justify-start sm:gap-10">
          <h1 className="shrink-0">
            <Wordmark animate className="h-14 w-auto min-[380px]:h-16 sm:h-28 md:h-36 [@media(max-height:620px)]:h-10" />
          </h1>
          <div>
            <p className="hidden max-w-sm text-lg text-ink-soft sm:block">No board, no luck, just bugs. Surround the other Queen Bee before yours is surrounded.</p>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 sm:mt-3 sm:justify-start">
              {resume && (
                <Link href={`/play?id=${resume.id}`} className="btn max-sm:!min-h-10 max-sm:!px-3">
                  <Icon name="play" size={18} />
                  Continue
                </Link>
              )}
              <Link href="/learn" className="font-hand text-xl text-ink underline decoration-line-strong decoration-1 underline-offset-4">
                How to play
              </Link>
              <Link href="/puzzles" className="hidden font-hand text-xl text-ink underline decoration-line-strong decoration-1 underline-offset-4 sm:inline">
                Puzzles
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="card mt-2 flex-1 space-y-4 !p-4 [@media(max-height:620px)]:mt-1 [@media(max-height:620px)]:space-y-3 [@media(max-height:620px)]:!py-3 sm:mt-4 sm:flex-none sm:space-y-6 sm:!p-7">
        <h2 className="hidden font-display text-2xl font-semibold sm:block">New game</h2>

        <div>
          <span className="label">Opponent</span>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => {
              const on = prefs.mode === m.id;
              return (
                <button key={m.id} onClick={() => update({ mode: m.id })} aria-pressed={on} className={`pencil flex flex-col items-center gap-1 px-1 py-2.5 text-center sm:flex-row sm:gap-3 sm:px-4 sm:py-3 sm:text-left ${on ? "pencil-honey pencil-strong" : "pencil-clear"}`}>
                  <Icon name={m.icon} size={22} className={on ? "text-ink" : "text-ink-soft"} />
                  <span>
                    <span className="block text-[0.85rem] leading-tight font-bold whitespace-nowrap sm:text-base">{m.title}</span>
                    <span className="hidden text-xs text-muted sm:block">{m.text}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {prefs.mode === "cpu" && (
          <div>
            <span className="label">Difficulty</span>
            <div className="seg seg-fill">
              {LEVELS.map((l) => (
                <button key={l.id} aria-pressed={prefs.level === l.id} onClick={() => update({ level: l.id })}>
                  {l.name}
                </button>
              ))}
            </div>
            <p className="hand-note mt-1 !text-lg max-sm:truncate">{lvl.blurb}</p>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          {prefs.mode !== "local" && (
            <div>
              <span className="label">You play</span>
              <div className="seg seg-fill">
                {(
                  [
                    ["w", "White"],
                    ["b", "Black"],
                    ["random", "Random"],
                  ] as [Prefs["color"], string][]
                ).map(([c, name]) => (
                  <button key={c} aria-pressed={prefs.color === c} onClick={() => update({ color: c })}>
                    {name}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted [@media(max-height:620px)]:hidden">White moves first.</p>
            </div>
          )}
          <div className="hidden sm:block">{clockPicker}</div>
        </div>

        <div className="hidden space-y-5 sm:block">
          {ratedToggle}
          {expansions}
          <AdvancedRules rules={prefs.rules} onChange={(rules) => update({ rules })} />
        </div>

        <button className="pencil pencil-clear pencil-dashed flex w-full items-center gap-3 px-3 py-2.5 text-left sm:hidden" onClick={() => setOptions(true)}>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Options</span>
            <span className="block truncate text-xs text-muted">{optionsSummary}</span>
          </span>
          <Icon name="chevron" className="-rotate-90 text-muted" />
        </button>

        {prefs.mode === "online" && !onlineAvailable() && <p className="note-error">Online play isn&apos;t configured on this deployment.</p>}
        {error && <p className="note-error">{error}</p>}
        <button className="btn-accent hidden !min-h-14 !px-10 !text-lg sm:inline-flex" disabled={busy || (prefs.mode === "online" && !onlineAvailable())} onClick={start}>
          {startLabel}
        </button>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 mt-2 bg-paper px-4 pt-2 sm:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}>
        <button className="btn-accent w-full !min-h-14 !text-lg" disabled={busy || (prefs.mode === "online" && !onlineAvailable())} onClick={start}>
          {startLabel}
        </button>
      </div>

      <Sheet open={options} onClose={() => setOptions(false)} title="Options">
        <div className="space-y-6 pb-2">
          {clockPicker}
          {ratedToggle}
          {expansions}
          <AdvancedRules rules={prefs.rules} onChange={(rules) => update({ rules })} />
        </div>
      </Sheet>

      {recent.length > 0 && (
        <section className="mt-8 hidden sm:block">
          <div className="flex items-baseline justify-between">
            <span className="label mb-0">Recent games</span>
            <Link href="/journal" className="font-hand text-lg text-ink-soft underline decoration-accent underline-offset-4">
              all games
            </Link>
          </div>
          <ul className="ruled mt-1">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {gameTitle(e)} <span className="text-sm text-muted">{resultLabel(e).toLowerCase()}, {e.moves.length} moves</span>
                </span>
                <Link href={`/replay?local=${e.id}`} className="font-hand shrink-0 text-lg text-ink-soft underline underline-offset-4">
                  replay
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
