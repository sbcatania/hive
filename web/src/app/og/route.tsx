import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { gamePreview, playerPreview, TAGLINE, type Preview } from "@/lib/preview";

// The preview picture a chat or social app shows for a link to Hive, 1200 by
// 630: /og for the site, ?g=<id> for an online game, ?u=<name> for a player.
// The wordmark is a picture made by scripts/og-wordmark.mjs, since its letters
// use Fraunces' variable axes, which this renderer can't draw.

export const runtime = "nodejs";

const asset = (p: string) => readFile(join(process.cwd(), p));
let loaded: Promise<{ fonts: { name: string; data: Buffer; weight: 400 | 500 | 600; style: "normal" }[]; wordmark: string }> | null = null;
const load = () =>
  (loaded ??= Promise.all([
    asset("assets/og/fraunces-latin-600-normal.woff"),
    asset("assets/og/alegreya-sans-latin-400-normal.woff"),
    asset("assets/og/alegreya-sans-latin-500-normal.woff"),
    asset("public/og/wordmark.png"),
  ]).then(([fraunces, sans, sansMedium, mark]) => ({
    fonts: [
      { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
      { name: "Alegreya Sans", data: sans, weight: 400, style: "normal" },
      { name: "Alegreya Sans", data: sansMedium, weight: 500, style: "normal" },
    ],
    wordmark: `data:image/png;base64,${mark.toString("base64")}`,
  })));

// The day palette from globals.css.
const C = { paper: "#fafaf9", card: "#ffffff", ink: "#1c1e21", soft: "#383b40", muted: "#6a6e74", dot: "#e3e7eb", honey: "#e2a628", honeySoft: "#f6e6bd" };

// A pencil outline like the site's cards (.pencil): a rounded rectangle drawn a
// little unevenly, twice, the second pass fainter.
function pencil(w: number, h: number, r: number) {
  const box = (o: number, j: number) =>
    `M${r + o} ${o + j}Q${w / 2} ${o - j} ${w - r - o} ${o + j}Q${w - o} ${o} ${w - o - j} ${r + o}Q${w - o + j} ${h / 2} ${w - o} ${h - r - o}Q${w - o} ${h - o} ${w - r - o} ${h - o + j}Q${w / 2} ${h - o - j} ${r + o} ${h - o}Q${o} ${h - o} ${o + j} ${h - r - o}Q${o - j} ${h / 2} ${o} ${r + o}Q${o} ${o} ${r + o} ${o + j}Z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${box(4, 1.2)}" fill="${C.card}" stroke="${C.ink}" stroke-width="3.2" stroke-linejoin="round"/><path d="${box(6, -1.4)}" fill="none" stroke="${C.ink}" stroke-width="1.2" opacity="0.35"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// A faint hex dot grid, as on the board.
function dots(w: number, h: number) {
  let d = "";
  for (let y = 12, row = 0; y < h; y += 26, row++) for (let x = row % 2 ? 27 : 12; x < w; x += 30) d += `<circle cx="${x}" cy="${y}" r="2.2"/>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g fill="${C.dot}">${d}</g></svg>`)}`;
}

// A small honey hexagon between items, like the site's own separators.
const Hex = () => <div style={{ width: 9, height: 10, backgroundColor: C.honey, clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }} />;

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);

function picture(p: Preview | null, wordmark: string) {
  if (!p) {
    // The site: the wordmark large, the tagline under it.
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: C.paper, backgroundImage: `url("${dots(1200, 630)}")`, padding: 32 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundImage: `url("${pencil(1136, 566, 40)}")`, padding: "40px 80px" }}>
          <img src={wordmark} width={560} height={264} alt="" />
          <div style={{ marginTop: 44, fontFamily: "Alegreya Sans", fontSize: 38, lineHeight: 1.3, color: C.soft, textAlign: "center", textWrap: "balance", maxWidth: 880 }}>{TAGLINE}</div>
          <div style={{ marginTop: 28, display: "flex", gap: 14, fontFamily: "Alegreya Sans", fontWeight: 500, fontSize: 26, color: C.muted }}>
            {["Against the computer", "Pass and play", "Online"].map((t, i) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {i > 0 && <Hex />}
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: C.paper, backgroundImage: `url("${dots(1200, 630)}")`, padding: 32 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", backgroundImage: `url("${pencil(1136, 566, 40)}")`, padding: "52px 68px 50px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img src={wordmark} width={260} height={123} alt="" />
          <div style={{ display: "flex", fontFamily: "Alegreya Sans", fontWeight: 500, fontSize: 26, color: C.ink, backgroundColor: C.honeySoft, borderRadius: 999, padding: "8px 22px" }}>{p.kicker}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: p.title.length > 26 ? 64 : 80, lineHeight: 1.06, color: C.ink, letterSpacing: -1, textWrap: "balance" }}>{clip(p.title, 60)}</div>
          <div style={{ display: "flex", fontFamily: "Alegreya Sans", fontSize: 34, lineHeight: 1.3, color: C.soft, textWrap: "pretty", maxWidth: 960 }}>{clip(p.description, 140)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "Alegreya Sans", fontSize: 26, color: C.muted }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {p.facts.map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {i > 0 && <Hex />}
                {f}
              </div>
            ))}
          </div>
          <div style={{ display: "flex" }}>hive.sbc.me</div>
        </div>
      </div>
    </div>
  );
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const g = q.get("g");
  const u = q.get("u");
  const [preview, { fonts, wordmark }] = await Promise.all([g ? gamePreview(g) : u ? playerPreview(u) : Promise.resolve(null), load()]);
  return new ImageResponse(picture(preview, wordmark), {
    width: 1200,
    height: 630,
    fonts,
    headers: {
      // Games change as they're played; the site's own picture doesn't.
      "Cache-Control": g || u ? "public, max-age=60, s-maxage=60, stale-while-revalidate=3600" : "public, max-age=86400, s-maxage=604800",
    },
  });
}
