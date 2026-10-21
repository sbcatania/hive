"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Avatar } from "@/components/Nameplate";
import type { Profile } from "@/lib/auth";
import { fetchPlayers, gamesForPlayer, type OnlineGame, type PlayerSummary } from "@/lib/online";
import { sb } from "@/lib/supabase";

function PlayerInner() {
  const params = useSearchParams();
  const name = params.get("u") ?? "";
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [games, setGames] = useState<OnlineGame[]>([]);
  const [players, setPlayers] = useState<Record<string, PlayerSummary>>({});

  useEffect(() => {
    (async () => {
      const { data } = await sb().from("profiles").select("*").ilike("username", name.replace(/[\\%_]/g, (c) => "\\" + c)).maybeSingle();
      setProfile((data as Profile) ?? null);
      if (data) {
        const g = (await gamesForPlayer((data as Profile).id, 30)).filter((x) => x.status === "finished");
        setGames(g);
        setPlayers(await fetchPlayers(g.flatMap((x) => [x.white_player, x.black_player])));
      }
    })().catch(() => setProfile(null));
  }, [name]);

  if (profile === undefined) return <div className="grid h-[50vh] place-items-center text-muted">Looking them up…</div>;
  if (!profile) return <div className="mx-auto max-w-md p-8 text-center text-muted">No player called “{name}”.</div>;

  const total = profile.wins + profile.losses + profile.draws;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="hex-card flex items-center gap-4 p-6">
        <Avatar color="w" initial={profile.username.slice(0, 1).toUpperCase()} size={72} />
        <div>
          <div className="specimen-label">Player</div>
          <h1 className="font-display text-4xl font-semibold">{profile.username}</h1>
          <div className="text-sm text-muted">Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="label mb-0">Rating</div>
          <div className="font-display text-4xl font-semibold">{profile.rated_games ? profile.rating : "—"}</div>
          <div className="text-xs text-muted">peak {profile.peak_rating}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {[
          ["Rated", profile.rated_games],
          ["Wins", profile.wins],
          ["Losses", profile.losses],
          ["Win rate", total ? `${Math.round((100 * (profile.wins + profile.draws / 2)) / total)}%` : "—"],
        ].map(([k, v]) => (
          <div key={k as string} className="card !p-3 text-center">
            <div className="label mb-0">{k}</div>
            <div className="font-display text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </div>
      <h2 className="font-display mt-8 text-2xl font-semibold">Recent games</h2>
      {games.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No finished online games yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {games.map((g) => {
            const me = g.white_player === profile.id ? "w" : "b";
            const oppId = me === "w" ? g.black_player : g.white_player;
            const won = g.result !== "Draw" && (g.result === "WhiteWins") === (me === "w");
            const delta = me === "w" ? g.white_delta : g.black_delta;
            return (
              <li key={g.id} className="card flex items-center gap-3 !p-3 text-sm">
                <span className={`w-12 font-semibold ${g.result === "Draw" ? "text-muted" : won ? "text-leaf" : "text-danger"}`}>{g.result === "Draw" ? "Draw" : won ? "Win" : "Loss"}</span>
                <span className="min-w-0 flex-1 truncate">
                  vs {oppId ? (players[oppId]?.username ?? "player") : "guest"} · {g.moves.length} moves
                </span>
                {g.rated && delta !== null && <span className="font-mono text-xs text-muted">{delta >= 0 ? `+${delta}` : delta}</span>}
                <Link className="btn-ghost" href={`/replay?online=${g.id}`}>
                  Replay
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense>
      <PlayerInner />
    </Suspense>
  );
}
