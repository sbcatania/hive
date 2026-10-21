"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Nameplate";
import { useAuth, type Profile } from "@/lib/auth";
import { sb, supabaseAvailable } from "@/lib/supabase";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseAvailable()) return;
    sb()
      .from("profiles")
      .select("*")
      .gt("rated_games", 0)
      .order("rating", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRows(data as Profile[]);
      });
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="specimen-label">The pecking order</div>
      <h1 className="font-display text-4xl font-semibold">Rankings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Elo ratings from rated online games. Everyone starts at 1200. New players move faster (K = 40 for the first 20 games, then 20).
      </p>
      {error && <p className="note-error mt-4">{error}</p>}
      {!rows ? (
        <p className="mt-6 text-muted">Counting the colony…</p>
      ) : rows.length === 0 ? (
        <div className="card mt-6 text-center">
          <p className="text-sm text-ink-soft">No rated games yet. Be the first on the board.</p>
          <Link href={user ? "/" : "/account"} className="btn mt-3">
            {user ? "Start a rated game" : "Create an account"}
          </Link>
        </div>
      ) : (
        <ol className="mt-6 space-y-1.5">
          {rows.map((p, i) => {
            const me = user?.id === p.id;
            return (
              <li key={p.id}>
                <Link
                  href={`/player?u=${encodeURIComponent(p.username)}`}
                  className={`flex items-center gap-3 sk-lg border px-3 py-2 transition hover:bg-card-2 ${me ? "border-accent bg-accent-soft/40" : "border-line bg-card"}`}
                >
                  <span className={`w-8 text-right font-display text-xl font-semibold ${i < 3 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                  <Avatar color={i % 2 ? "b" : "w"} initial={p.username.slice(0, 1).toUpperCase()} bug={i === 0 ? "Q" : undefined} size={36} />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {p.username}
                    {me && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                  </span>
                  <span className="hidden text-xs text-muted sm:inline">
                    {p.wins}W {p.losses}L {p.draws}D
                  </span>
                  <span className="w-14 text-right font-mono text-lg font-semibold">{p.rating}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
