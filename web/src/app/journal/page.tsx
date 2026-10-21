"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Engine, errorMessage, loadEngine } from "@/lib/engine";
import { normalizeRules } from "@/lib/engine-types";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { deleteCloud, deleteLocal, gameTitle, newId, saveLocal, setCurrentGameId, listCloud, listLocal, REASON_TEXT, resultLabel, type JournalEntry } from "@/lib/journal";
import { fetchPlayers, gamesForPlayer, type OnlineGame, type PlayerSummary } from "@/lib/online";
import { describeVariants, expansionLabel } from "@/lib/variants";
import { useDialogs } from "@/components/Dialogs";

function when(t: number | string) {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function Badge({ text, tone }: { text: string; tone: "win" | "loss" | "draw" | "open" }) {
  const cls = { win: "text-move", loss: "text-danger", draw: "text-ink-soft", open: "text-accent-strong" }[tone];
  return <span className={`font-hand text-lg leading-none ${cls}`}>{text}</span>;
}

export default function JournalPage() {
  const { user } = useAuth();
  const dialogs = useDialogs();
  const [tab, setTab] = useState<"saved" | "online">("saved");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [online, setOnline] = useState<OnlineGame[]>([]);
  const [players, setPlayers] = useState<Record<string, PlayerSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const local = listLocal();
      let merged = local;
      if (user) {
        try {
          const cloud = await listCloud();
          const byId = new Map(cloud.map((e) => [e.id, e]));
          for (const l of local) if (!byId.has(l.id) || byId.get(l.id)!.updatedAt < l.updatedAt) byId.set(l.id, l);
          merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
          const games = await gamesForPlayer(user.id);
          if (!alive) return;
          setOnline(games);
          setPlayers(await fetchPlayers(games.flatMap((g) => [g.white_player, g.black_player])));
        } catch (e) {
          setError(String(e));
        }
      }
      if (!alive) return;
      setEntries(merged.filter((e) => e.moves.length > 0));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  async function remove(e: JournalEntry) {
    if (!(await dialogs.confirm({ title: "Delete this game?", message: "It will be removed from this device and your account.", confirm: "Delete", danger: true }))) return;
    deleteLocal(e.id);
    if (user) await deleteCloud(e.id).catch(() => {});
    setEntries((list) => list.filter((x) => x.id !== e.id));
  }

  async function importGame() {
    setError(null);
    try {
      await loadEngine();
      const g = Engine.fromGameString(importText.trim(), true);
      const st = g.state();
      g.free();
      const now = Date.now();
      const entry: JournalEntry = { id: newId(), mode: "local", rules: normalizeRules(st.rules), moves: st.history, label: "Imported game", human: "w", createdAt: now, updatedAt: now };
      saveLocal(entry);
      setCurrentGameId(entry.id);
      router.push(`/play?id=${entry.id}`);
    } catch (e) {
      setError("Couldn't load that game: " + errorMessage(e));
    }
  }

  const tone = (label: string) => (label === "You won" ? "win" : label === "You lost" ? "loss" : label === "In progress" ? "open" : "draw");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-4xl font-semibold">Your games</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {user ? "Every game you've played, in this browser and on your account." : "Games are saved in this browser."}{" "}
        {!user && (
          <Link href="/account" className="underline">
            Sign in to keep them across devices.
          </Link>
        )}
      </p>

      <div className="seg mt-5">
        <button aria-pressed={tab === "saved"} onClick={() => setTab("saved")}>
          On this device ({entries.length})
        </button>
        <button aria-pressed={tab === "online"} onClick={() => setTab("online")}>
          Online{user ? ` (${online.length})` : ""}
        </button>
      </div>
      {error && <p className="note-error mt-3">{error}</p>}

      {loading ? (
        <p className="mt-6 text-muted">Opening the journal…</p>
      ) : tab === "saved" ? (
        entries.length === 0 ? (
          <div className="card mt-4 text-center text-sm text-muted">
            No games yet. <Link href="/" className="underline">Start one</Link>.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {entries.map((e) => {
              const label = resultLabel(e);
              const v = describeVariants(e.rules);
              return (
                <li key={e.id} className="card flex flex-wrap items-center gap-3 !p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{gameTitle(e)}</span>
                      <Badge text={label} tone={tone(label)} />
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {when(e.updatedAt)}. {e.moves.length} moves, {expansionLabel(e.rules)}
                      {v.length ? `, ${v.join(", ")}` : ""}.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!e.result && (
                      <Link className="btn !px-3 !py-1.5" href={`/play?id=${e.id}`}>
                        Continue
                      </Link>
                    )}
                    <Link className="btn-secondary !px-3 !py-1.5" href={`/replay?local=${e.id}`}>
                      Replay
                    </Link>
                    <button className="icon-btn !h-10 !w-10 [--fill:transparent]" onClick={() => remove(e)} aria-label="Delete">
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : !user ? (
        <div className="card mt-4 text-sm">
          <Link href="/account" className="underline">
            Sign in
          </Link>{" "}
          to see your online games. Guest games are reachable from their links.
        </div>
      ) : online.length === 0 ? (
        <div className="card mt-4 text-center text-sm text-muted">No online games yet.</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {online.map((g) => {
            const me: "w" | "b" = g.white_player === user.id ? "w" : "b";
            const oppId = me === "w" ? g.black_player : g.white_player;
            const opp = oppId ? (players[oppId]?.username ?? "Player") : "Guest";
            const won = g.result && ((g.result === "WhiteWins") === (me === "w"));
            const label = g.status !== "finished" ? (g.status === "waiting" ? "Waiting" : "In progress") : g.result === "Draw" ? "Draw" : won ? "You won" : "You lost";
            const delta = me === "w" ? g.white_delta : g.black_delta;
            return (
              <li key={g.id} className="card flex flex-wrap items-center gap-3 !p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">vs {opp}</span>
                    <Badge text={label} tone={label === "You won" ? "win" : label === "You lost" ? "loss" : g.status === "finished" ? "draw" : "open"} />
                    {g.rated && <span className="text-xs font-semibold text-accent">Rated{delta !== null ? ` ${delta >= 0 ? "+" : ""}${delta}` : ""}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {when(g.updated_at)}. You were {me === "w" ? "White" : "Black"}, {g.moves.length} moves.
                  </div>
                </div>
                <div className="flex gap-2">
                  {g.status !== "finished" && (
                    <Link className="btn !px-3 !py-1.5" href={`/online?g=${g.id}`}>
                      Open
                    </Link>
                  )}
                  <Link className="btn-secondary !px-3 !py-1.5" href={`/replay?online=${g.id}`}>
                    Replay
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <details className="mt-10">
        <summary className="cursor-pointer font-hand text-xl text-ink-soft">Load a game from notation…</summary>
        <p className="mt-2 text-xs text-muted">
          Paste a Universal Hive Protocol game string, e.g. <code className="font-mono">Base+MLP;InProgress;White[2];wA1;bG1 -wA1</code>. It opens as a pass-and-play game.
        </p>
        <textarea className="input mt-2 h-24 font-mono text-xs" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Base+MLP;InProgress;White[3];wS1;bS1 wS1-;..." />
        <button className="btn-secondary mt-2" onClick={importGame} disabled={!importText.trim()}>
          Load game
        </button>
      </details>
    </div>
  );
}
