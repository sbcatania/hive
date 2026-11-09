// What a link to Hive shows when it's pasted into a chat, a post or an email:
// a title, a line, and a picture (app/og/route.tsx). Online games and player
// profiles are public in the database, so their links name the players.
import { resultSentence } from "./journal";

export const SITE = "https://hive.sbc.me";
export const TAGLINE = "No board, no luck, just bugs. Surround the other Queen Bee before yours is surrounded.";
export const DESCRIPTION =
  "Play Hive with the Mosquito, Ladybug and Pillbug: against four CPU opponents, pass-and-play, or online with a friend. Rated games, puzzles and an illustrated field guide to the rules.";

export interface Preview {
  /** The headline (og:title, and the page title before " · Hive"). */
  title: string;
  description: string;
  /** A short label over the headline in the picture. */
  kicker: string;
  /** Small facts under the line in the picture: clock, rated, and so on. */
  facts: string[];
  /** Query string for /og. */
  image: string;
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function rest<T>(path: string): Promise<T | null> {
  if (!URL_ || !KEY) return null;
  try {
    const res = await fetch(`${URL_}/rest/v1/${path}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(2500),
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface GameRow {
  id: string;
  status: "waiting" | "active" | "finished";
  result: string | null;
  result_reason: string | null;
  base_ms: number | null;
  increment_ms: number;
  rated: boolean;
  moves: string[];
  white_player: string | null;
  black_player: string | null;
  white_joined: boolean;
  black_joined: boolean;
}

const clock = (g: GameRow) => (g.base_ms ? `${g.base_ms / 60000} + ${g.increment_ms / 1000}` : "No clock");

const GAME_ID = /^[A-Za-z0-9_-]{4,64}$/;
const USERNAME = /^[A-Za-z0-9_.-]{1,40}$/;

/** An online game's link: an invitation while it waits, the players after. */
export async function gamePreview(id: string): Promise<Preview | null> {
  if (!GAME_ID.test(id)) return null;
  const rows = await rest<GameRow[]>(
    `games?id=eq.${encodeURIComponent(id)}&select=id,status,result,result_reason,base_ms,increment_ms,rated,moves,white_player,black_player,white_joined,black_joined`,
  );
  const g = rows?.[0];
  if (!g) return null;
  const ids = [g.white_player, g.black_player].filter((x): x is string => !!x);
  const people = ids.length
    ? ((await rest<{ id: string; username: string; rating: number }[]>(
        `profiles?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,username,rating`,
      )) ?? [])
    : [];
  const who = (pid: string | null) => people.find((p) => p.id === pid);
  const white = who(g.white_player);
  const black = who(g.black_player);
  const named = (p: typeof white, side: string) => (p ? `${p.username} (${p.rating})` : side);
  const facts = [clock(g), g.rated ? "Rated" : "Casual"];
  const image = `g=${encodeURIComponent(g.id)}`;

  if (g.status === "waiting") {
    const host = white ?? black;
    return {
      title: host ? `${host.username} invited you to play Hive` : "You’re invited to play Hive",
      description: `Open the link to take the empty seat${host ? ` against ${host.username} (rated ${host.rating})` : ""}. ${facts.join(" · ")}.`,
      kicker: "Online game · Waiting for you",
      facts,
      image,
    };
  }
  const vs = white || black ? `${named(white, "White")} vs ${named(black, "Black")}` : "";
  const title = white || black ? `${white?.username ?? "White"} vs ${black?.username ?? "Black"}` : "A game of Hive";
  if (g.status === "active") {
    return {
      title,
      description: `A live game of Hive, ${g.moves.length} moves in${vs ? `: ${vs}` : ""}. Open the link to watch.`,
      kicker: "Online game · Live",
      facts,
      image,
    };
  }
  const result = g.result ? resultSentence(g.result, g.result_reason) : "Finished";
  return {
    title,
    description: `${result} after ${g.moves.length} ${g.moves.length === 1 ? "move" : "moves"}.${vs ? ` ${vs}.` : ""}`,
    kicker: "Online game · Finished",
    facts: [result, ...facts],
    image,
  };
}

/** A player's profile link. */
export async function playerPreview(username: string): Promise<Preview | null> {
  if (!USERNAME.test(username)) return null;
  const rows = await rest<{ username: string; rating: number; rated_games: number }[]>(
    `profiles?username=eq.${encodeURIComponent(username)}&select=username,rating,rated_games`,
  );
  const p = rows?.[0];
  if (!p) return null;
  const games = `${p.rated_games} rated ${p.rated_games === 1 ? "game" : "games"}`;
  return {
    title: p.username,
    description: p.rated_games
      ? `${p.username} plays Hive: rated ${p.rating} after ${games}. See their games and challenge them.`
      : `${p.username} plays Hive. See their games and challenge them.`,
    kicker: "Player",
    facts: p.rated_games ? [`Rating ${p.rating}`, games] : ["No rated games yet"],
    image: `u=${encodeURIComponent(p.username)}`,
  };
}

/** Next.js metadata for a preview. */
export function previewMetadata(p: Preview, path: string) {
  const image = { url: `/og?${p.image}`, width: 1200, height: 630, alt: `${p.title}. ${p.description}` };
  return {
    title: p.title,
    description: p.description,
    openGraph: { type: "website" as const, siteName: "Hive", title: p.title, description: p.description, url: path, images: [image] },
    twitter: { card: "summary_large_image" as const, title: p.title, description: p.description, images: [image] },
  };
}
