"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { persona } from "@/lib/engine-types";
import { deleteCloud, deleteLocal, listCloud, listLocal, REASON_TEXT, resultLabel, type JournalEntry } from "@/lib/journal";
import { fetchPlayers, gamesForPlayer, type OnlineGame, type PlayerSummary } from "@/lib/online";
import { describeVariants, expansionLabel } from "@/lib/variants";

function when(t: number | string) {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function Badge({ text, tone }: { text: string; tone: "win" | "loss" | "draw" | "open" }) {
  const cls = { win: "bg-leaf/15 text-leaf ring-leaf/40", loss: "bg-danger/10 text-danger ring-danger/30", draw: "bg-paper-2 text-ink-soft ring-line", open: "bg-accent-soft text-ink ring-accent/40" }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>{text}</span>;
}

export default function JournalPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"saved" | "online">("saved");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [online, setOnline] = useState<OnlineGame[]>([]);
  const [players, setPlayers] = useState<Record<string, PlayerSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (!confirm("Delete this game from your journal?")) return;
    deleteLocal(e.id);
    if (user) await deleteCloud(e.id).catch(() => {});
    setEntries((list) => list.filter((x) => x.id !== e.id));
  }

  const tone = (label: string) => (label === "You won" ? "win" : label === "You lost" ? "loss" : label === "In progress" ? "open" : "draw");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="specimen-label">Observations</div>
      <h1 className="font-display text-4xl font-semibold">Your journal</h1>
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
          CPU &amp; pass-and-play ({entries.length})
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
                      <span className="font-semibold">{e.label || (e.level ? `vs ${persona(e.level).name}` : "Game")}</span>
                      <Badge text={label} tone={tone(label)} />
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {when(e.updatedAt)} · {e.moves.length} moves · {expansionLabel(e.rules)}
                      {v.length ? ` · ${v.join(", ")}` : ""}
                      {e.resultReason ? ` · ${REASON_TEXT[e.resultReason] ?? e.resultReason}` : ""}
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
                    <button className="btn-ghost" onClick={() => remove(e)} aria-label="Delete">
                      ✕
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
                    {when(g.updated_at)} · you were {me === "w" ? "White" : "Black"} · {g.moves.length} moves
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
    </div>
  );
}
