"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Nameplate";
import { BugGlyph } from "@/components/BugGlyph";
import { AdvancedRules, ExpansionToggles } from "@/components/RulesEditor";
import { TitleHive } from "@/components/TitleHive";
import { useAuth } from "@/lib/auth";
import { Engine, errorMessage, loadEngine } from "@/lib/engine";
import { isStandardRules, LEVELS, normalizeRules, persona, standardRules, type BugLetter, type ColorCode, type Level, type Rules } from "@/lib/engine-types";
import { listLocal, migrateLegacySave, newId, resultLabel, resumable, saveLocal, setCurrentGameId, type JournalEntry } from "@/lib/journal";
import { createOnlineGame, onlineAvailable, TIME_CONTROLS } from "@/lib/online";
import { LOCAL_CLOCKS, loadSetupPrefs, saveSetupPrefs } from "@/lib/settings";
import { roundedHexPath, TILE } from "@/lib/themes";
import { describeVariants, expansionLabel } from "@/lib/variants";

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

const MODES: { id: Mode; bug: BugLetter; title: string; latin: string; text: string }[] = [
  { id: "cpu", bug: "S", title: "Play the computer", latin: "Arachne computatrix", text: "Four bug opponents, from cheerful beginner to ruthless Queen." },
  { id: "local", bug: "L", title: "Pass & play", latin: "Coccinella amicorum", text: "Two players, one screen. Hand the device across the table." },
  { id: "online", bug: "Q", title: "Play a friend online", latin: "Apis distantia", text: "Send a link. Clocks, takebacks, spectators and rated games." },
];

function ModeCard({ m, active, onClick, i }: { m: (typeof MODES)[number]; active: boolean; onClick: () => void; i: number }) {
  const t = TILE[i === 1 ? "b" : "w"];
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`hex-card rise group flex flex-col items-start gap-3 p-5 text-left transition ${active ? "!border-accent !bg-accent-soft/50" : "hover:-translate-y-0.5"}`}
      style={{ animationDelay: `${300 + i * 90}ms` }}
    >
      <div className="flex w-full items-start justify-between">
        <svg viewBox="-50 -50 100 100" className="h-16 w-16 transition group-hover:rotate-6" aria-hidden>
          <path d={roundedHexPath(0, 5, 46, 0.2)} fill={t.side} />
          <path d={roundedHexPath(0, 0, 46, 0.2)} fill={t.fill} stroke={i === 1 ? "var(--tile-black-rim)" : t.edge} strokeWidth={3} />
          <g transform="translate(-31 -31) scale(0.62)">
            <BugGlyph bug={m.bug} ink={t.ink} />
          </g>
        </svg>
        <span className={active ? "rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-ink uppercase" : "specimen-label"}>{active ? "Selected" : `No. ${i + 1}`}</span>
      </div>
      <div>
        <div className="font-display text-xl font-semibold">{m.title}</div>
        <div className="specimen-label mt-0.5 italic">{m.latin}</div>
        <p className="mt-2 text-sm text-ink-soft">{m.text}</p>
      </div>
    </button>
  );
}

function PersonaCard({ level, active, onClick }: { level: Level; active: boolean; onClick: () => void }) {
  const p = persona(level);
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex gap-3 rounded-2xl border p-3 text-left transition ${active ? "border-accent bg-accent-soft/40 ring-2 ring-accent/30" : "border-line bg-card hover:border-line-strong"}`}
    >
      <Avatar bug={p.bug} color={level === "hard" || level === "medium" ? "b" : "w"} size={46} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-lg font-semibold">{p.name}</span>
          <span className="text-xs text-muted">{p.title}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1" aria-label={`Strength ${p.strength} of 4`}>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`h-1.5 w-5 rounded-full ${n <= p.strength ? "bg-accent" : "bg-line"}`} />
          ))}
          <span className="ml-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{level}</span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">{p.temperament}</p>
      </div>
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [resume, setResume] = useState<JournalEntry | null>(null);
  const [recent, setRecent] = useState<JournalEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");

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
    const p = persona(prefs.level);
    const entry: JournalEntry = {
      id: newId(),
      mode: prefs.mode,
      rules: prefs.rules,
      moves: [],
      label: prefs.mode === "cpu" ? `vs ${p.name} ${p.title}` : "Pass & play",
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

  async function importGame() {
    setError(null);
    try {
      await loadEngine();
      const e = Engine.fromGameString(importText.trim(), prefs.rules.tournament);
      const s = e.state();
      e.free();
      const now = Date.now();
      const entry: JournalEntry = { id: newId(), mode: "local", rules: normalizeRules({ ...s.rules, tournament: prefs.rules.tournament }), moves: s.history, label: "Imported game", human: "w", createdAt: now, updatedAt: now };
      saveLocal(entry);
      setCurrentGameId(entry.id);
      router.push(`/play?id=${entry.id}`);
    } catch (e) {
      setError("Couldn't load that game: " + errorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      {/* Title moment */}
      <section className="grid items-center gap-6 pt-8 pb-6 md:grid-cols-[1.1fr_1fr] md:pt-14">
        <div className="rise">
          <div className="specimen-label">A field guide to the board game</div>
          <h1 className="font-display mt-1 text-6xl leading-[0.95] font-semibold tracking-tight sm:text-7xl">
            Hive<span className="text-accent">.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-ink-soft">
            No board, no luck, just bugs. Surround your opponent&apos;s Queen Bee before they surround yours.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {resume && (
              <Link href={`/play?id=${resume.id}`} className="btn">
                Continue: {resume.label} · move {resume.moves.length + 1}
              </Link>
            )}
            <Link href="/learn" className="btn-secondary">
              New to Hive? Read the field guide
            </Link>
            <Link href="/puzzles" className="btn-secondary">
              Try a puzzle
            </Link>
          </div>
        </div>
        <TitleHive className="mx-auto w-full max-w-[240px] drop-shadow-sm sm:max-w-sm md:max-w-md" />
      </section>

      {/* Modes */}
      <section className="grid gap-3 md:grid-cols-3">
        {MODES.map((m, i) => (
          <ModeCard key={m.id} m={m} i={i} active={prefs.mode === m.id} onClick={() => update({ mode: m.id })} />
        ))}
      </section>

      {/* Setup sheet */}
      <section className="card rise mt-4 space-y-6 !p-5 sm:!p-6" key={prefs.mode}>
        {prefs.mode === "cpu" && (
          <div>
            <span className="label">Choose your opponent</span>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {LEVELS.map((l) => (
                <PersonaCard key={l.id} level={l.id} active={prefs.level === l.id} onClick={() => update({ level: l.id })} />
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {prefs.mode !== "local" && (
            <div>
              <span className="label">You play</span>
              <div className="seg">
                {(
                  [
                    ["w", "White · moves first"],
                    ["b", "Black"],
                    ["random", "Random"],
                  ] as [Prefs["color"], string][]
                ).map(([c, name]) => (
                  <button key={c} aria-pressed={prefs.color === c} onClick={() => update({ color: c })}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <span className="label">Clock</span>
            <div className="seg">
              {(prefs.mode === "online" ? TIME_CONTROLS : LOCAL_CLOCKS).map((tc) => {
                const key = prefs.mode === "online" ? "onlineClock" : "localClock";
                return (
                  <button key={tc.id} aria-pressed={prefs[key] === tc.id} onClick={() => update({ [key]: tc.id } as Partial<Prefs>)}>
                    {tc.name}
                  </button>
                );
              })}
            </div>
          </div>
          {prefs.mode === "online" && (
            <div className="sm:col-span-2">
              <span className="label">Rating</span>
              <label className={`flex items-start gap-3 text-sm ${ratedAllowed ? "" : "opacity-60"}`}>
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" disabled={!ratedAllowed} checked={prefs.rated && ratedAllowed} onChange={(e) => update({ rated: e.target.checked })} />
                <span>
                  <span className="font-medium">Rated game</span>
                  <span className="block text-xs text-muted">
                    {!user ? (
                      <>
                        <Link href="/account" className="underline">
                          Sign in
                        </Link>{" "}
                        to play rated games. Both players need an account; ratings use Elo, starting at 1200.
                      </>
                    ) : variant ? (
                      "Rated games use the official rules. Reset the advanced rules to enable rating."
                    ) : (
                      "Both players need an account. Win to gain Elo; your opponent must be signed in to join."
                    )}
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>

        <div>
          <span className="label">Expansion pieces · {expansionLabel(prefs.rules)}</span>
          <ExpansionToggles rules={prefs.rules} onChange={(rules) => update({ rules })} />
        </div>

        <AdvancedRules rules={prefs.rules} onChange={(rules) => update({ rules })} />

        {prefs.mode === "online" && !onlineAvailable() && <p className="note-error">Online play isn&apos;t configured on this deployment.</p>}
        {error && <p className="note-error">{error}</p>}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted">
            {prefs.mode === "cpu" ? `${persona(prefs.level).name} plays ${prefs.color === "w" ? "Black" : prefs.color === "b" ? "White" : "the other colour"}.` : prefs.mode === "local" ? "White moves first. Pass the device after each turn." : "You'll get a link to share."}
          </div>
          <button className="btn px-8 py-3 text-base" disabled={busy || (prefs.mode === "online" && !onlineAvailable())} onClick={start}>
            {busy ? "Creating game…" : prefs.mode === "online" ? "Create game & get link" : prefs.mode === "cpu" ? `Challenge ${persona(prefs.level).name}` : "Start game"}
          </button>
        </div>
      </section>

      {/* Below the fold */}
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between">
            <span className="label mb-0">From your journal</span>
            <Link href="/journal" className="text-xs text-muted underline">
              All games
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Finished games appear here, ready to replay. {user ? "They're saved to your account." : "They're saved in this browser; sign in to keep them across devices."}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.label}</div>
                    <div className="text-xs text-muted">
                      {resultLabel(e)} · {e.moves.length} moves
                    </div>
                  </div>
                  <Link href={`/replay?local=${e.id}`} className="btn-ghost">
                    Replay
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold">Load a game from notation</summary>
          <p className="mt-2 text-xs text-muted">
            Paste a Universal Hive Protocol game string, e.g. <code className="font-mono">Base+MLP;InProgress;White[2];wA1;bG1 -wA1</code>. It opens as a pass-and-play game.
          </p>
          <textarea className="input mt-2 h-24 font-mono text-xs" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Base+MLP;InProgress;White[3];wS1;bS1 wS1-;..." />
          <button className="btn-secondary mt-2" onClick={importGame} disabled={!importText.trim()}>
            Load game
          </button>
        </details>
      </section>
    </div>
  );
}
