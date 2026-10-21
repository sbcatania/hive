"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BugGlyph, hexPoints } from "@/components/BugGlyph";
import { Engine, errorMessage, loadEngine } from "@/lib/engine";
import { BUG_NAMES, LEVELS, type BugLetter, type ColorCode, type Level, type Rules } from "@/lib/engine-types";
import { createOnlineGame, onlineAvailable, TIME_CONTROLS } from "@/lib/online";
import { DEFAULT_RULES, loadSavedGame, loadSetupPrefs, saveGame, saveSetupPrefs, settingsToQuery, type LocalMode } from "@/lib/settings";
import { TILE } from "@/lib/themes";

type Mode = LocalMode | "online";

interface Prefs {
  mode: Mode;
  rules: Rules;
  level: Level;
  color: ColorCode | "random";
  timeControl: string;
}

const DEFAULT_PREFS: Prefs = { mode: "cpu", rules: DEFAULT_RULES, level: "medium", color: "w", timeControl: "none" };

function Tile({ bug, color = "w", size = 44 }: { bug: BugLetter; color?: ColorCode; size?: number }) {
  const t = TILE[color];
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size}>
      <polygon points={hexPoints(0, 0, 46)} fill={t.fill} stroke={t.edge} strokeWidth={3} />
      <g transform="translate(-28 -28) scale(0.56)">
        <BugGlyph bug={bug} ink={t.ink} />
      </g>
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [hasSaved, setHasSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    setPrefs(loadSetupPrefs(DEFAULT_PREFS));
    const saved = loadSavedGame();
    setHasSaved(!!saved && saved.moves.length > 0 && !saved.result);
  }, []);

  function update(p: Partial<Prefs>) {
    const next = { ...prefs, ...p };
    setPrefs(next);
    saveSetupPrefs(next);
  }
  const setRule = (k: keyof Rules, v: boolean) => update({ rules: { ...prefs.rules, [k]: v } });

  async function start() {
    setError(null);
    if (prefs.mode === "online") {
      setBusy(true);
      try {
        const { id } = await createOnlineGame(prefs.rules, prefs.color, prefs.timeControl);
        router.push(`/online?g=${id}`);
      } catch (e) {
        setError(errorMessage(e));
        setBusy(false);
      }
      return;
    }
    const color = prefs.color === "random" ? (Math.random() < 0.5 ? "w" : "b") : prefs.color;
    const q = settingsToQuery({ mode: prefs.mode, rules: prefs.rules, level: prefs.level, human: color });
    router.push(`/play?${q}`);
  }

  async function importGame() {
    setError(null);
    try {
      await loadEngine();
      const text = importText.trim();
      const e = Engine.fromGameString(text, prefs.rules.tournament);
      const s = e.state();
      e.free();
      saveGame({
        settings: { mode: "local", rules: { ...s.rules, tournament: prefs.rules.tournament }, level: prefs.level, human: "w" },
        moves: s.history,
      });
      router.push("/play?resume=1");
    } catch (e) {
      setError("Couldn't load that game: " + errorMessage(e));
    }
  }

  const expansions: { key: "mosquito" | "ladybug" | "pillbug"; bug: BugLetter; text: string }[] = [
    { key: "mosquito", bug: "M", text: "Copies the movement of any piece it touches." },
    { key: "ladybug", bug: "L", text: "Two steps over the top of the hive, then one down." },
    { key: "pillbug", bug: "P", text: "Can lift an adjacent piece over itself to another side." },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <section className="mb-8 flex flex-col items-start gap-6 md:flex-row md:items-center">
        <div className="flex-1">
          <h1 className="text-4xl font-bold tracking-tight">Hive</h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            The bug-themed strategy game with no board. Surround your opponent&apos;s Queen Bee before they surround yours. Play against the
            computer, pass-and-play on one device, or send a friend a link.
          </p>
          <div className="mt-4 flex gap-3">
            {hasSaved && (
              <Link className="btn-secondary" href="/play?resume=1">
                Resume last game
              </Link>
            )}
            <Link className="btn-secondary" href="/rules">
              Learn the rules
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {(["Q", "A", "G", "S", "B", "M", "L", "P"] as BugLetter[]).map((b, i) => (
            <Tile key={b} bug={b} color={i % 2 ? "b" : "w"} size={56} />
          ))}
        </div>
      </section>

      <section className="card space-y-6">
        <div>
          <span className="label">Opponent</span>
          <div className="seg">
            {(
              [
                ["cpu", "Computer"],
                ["local", "Pass & play"],
                ["online", "Online friend"],
              ] as [Mode, string][]
            ).map(([m, name]) => (
              <button key={m} aria-pressed={prefs.mode === m} onClick={() => update({ mode: m })}>
                {name}
              </button>
            ))}
          </div>
          {prefs.mode === "online" && !onlineAvailable() && (
            <p className="mt-2 text-sm text-red-600">Online play isn&apos;t configured on this deployment (missing Supabase settings).</p>
          )}
        </div>

        {prefs.mode === "cpu" && (
          <div>
            <span className="label">Difficulty</span>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => update({ level: l.id })}
                  className={`rounded-lg border p-3 text-left text-sm transition ${prefs.level === l.id ? "border-amber-500 bg-amber-50 ring-2 ring-amber-500/30 dark:bg-amber-950/30" : "border-[var(--line)] hover:border-amber-300"}`}
                >
                  <div className="font-semibold">{l.name}</div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">{l.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {prefs.mode !== "local" && (
          <div>
            <span className="label">You play</span>
            <div className="seg">
              {(
                [
                  ["w", "White (moves first)"],
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

        {prefs.mode === "online" && (
          <div>
            <span className="label">Time control</span>
            <div className="seg">
              {TIME_CONTROLS.map((tc) => (
                <button key={tc.id} aria-pressed={prefs.timeControl === tc.id} onClick={() => update({ timeControl: tc.id })}>
                  {tc.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="label">Expansion pieces</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {expansions.map((x) => (
              <label
                key={x.key}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${prefs.rules[x.key] ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-[var(--line)] opacity-70"}`}
              >
                <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={prefs.rules[x.key]} onChange={(e) => setRule(x.key, e.target.checked)} />
                <Tile bug={x.bug} size={40} />
                <div>
                  <div className="font-semibold">{BUG_NAMES[x.bug]}</div>
                  <div className="text-xs text-[var(--muted)]">{x.text}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Opening rule</span>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-amber-500" checked={prefs.rules.tournament} onChange={(e) => setRule("tournament", e.target.checked)} />
            <span>
              <span className="font-medium">Tournament opening</span>
              <span className="block text-xs text-[var(--muted)]">Neither player may place their Queen Bee on their first turn. Recommended; it prevents some drawish openings.</span>
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full py-3 text-base" disabled={busy || (prefs.mode === "online" && !onlineAvailable())} onClick={start}>
          {busy ? "Creating game…" : prefs.mode === "online" ? "Create game & get link" : "Start game"}
        </button>
      </section>

      <details className="card mt-6">
        <summary className="cursor-pointer text-sm font-medium">Load a game from notation</summary>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Paste a game string in Universal Hive Protocol format, e.g. <code>Base+MLP;InProgress;White[2];wA1;bG1 -wA1</code>. It opens as a pass-and-play game you can continue or study.
        </p>
        <textarea
          className="mt-2 h-24 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2 font-mono text-xs"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Base+MLP;InProgress;White[3];wS1;bS1 wS1-;..."
        />
        <button className="btn-secondary mt-2" onClick={importGame} disabled={!importText.trim()}>
          Load game
        </button>
      </details>
    </div>
  );
}
