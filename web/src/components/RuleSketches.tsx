import type { ReactNode } from "react";
import { PieceTile, sketchHexPath } from "./PieceTile";
import type { BugLetter, ColorCode } from "@/lib/engine-types";

/* Margin doodles for the field guide: tiny hand-drawn scenes, most with a short
 * looping animation. Each element's resting style is the explanatory frame, so with
 * reduced motion (which switches every animation off) the sketch still reads. */

const SQ3 = Math.sqrt(3);
const at = (q: number, r: number, s: number) => [s * SQ3 * (q + r / 2), s * 1.5 * r] as const;
const n1 = (v: number) => +v.toFixed(1);

const BASE = `
.rule-sketch .fb{transform-box:fill-box;transform-origin:center}
.rule-sketch .draw{stroke-dasharray:1;stroke-dashoffset:0}
@media (prefers-reduced-motion: reduce){.rule-sketch *{animation:none !important}}
`;

function Sketch({
  vb,
  width,
  label,
  caption,
  css = "",
  children,
  className = "",
}: {
  vb: [number, number, number, number];
  width: number;
  label: string;
  caption?: ReactNode;
  css?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`rule-sketch flex max-w-full shrink-0 flex-col items-center ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: BASE + css }} />
      <svg viewBox={vb.join(" ")} width={width} height={n1((width * vb[3]) / vb[2])} className="block h-auto max-w-full overflow-visible" role="img" aria-label={label}>
        {children}
      </svg>
      {caption && <figcaption className="mt-0.5 -rotate-1 text-center font-hand text-[1.15rem] leading-tight whitespace-nowrap text-muted">{caption}</figcaption>}
    </figure>
  );
}

function Tile({ q, r, s, bug, color, seed = 0 }: { q: number; r: number; s: number; bug: BugLetter; color: ColorCode; seed?: number }) {
  const [x, y] = at(q, r, s);
  return <PieceTile bug={bug} color={color} x={x} y={y} size={s} seed={seed} />;
}

/** An empty cell, pencilled in with a dashed line. */
function Cell({ x, y, s, seed = 1, stroke = "var(--line-strong)", fill = "none", dash = "3 4" }: { x: number; y: number; s: number; seed?: number; stroke?: string; fill?: string; dash?: string }) {
  return <path d={sketchHexPath(x, y, s * 0.88, seed, 0.04)} fill={fill} stroke={stroke} strokeWidth={1.3} strokeDasharray={dash} strokeLinecap="round" />;
}

/** "Any piece": a plain hatched-grey tile without a bug. */
function Blank({ x, y, s, seed = 1 }: { x: number; y: number; s: number; seed?: number }) {
  return (
    <g>
      <path d={sketchHexPath(x, y, s * 0.93, seed)} fill="color-mix(in oklab, var(--ink) 10%, var(--card))" stroke="var(--line-strong)" strokeWidth={s * 0.07} strokeLinejoin="round" />
      <path d={sketchHexPath(x, y, s * 0.9, seed + 3, 0.05)} fill="none" stroke="var(--ink-soft)" strokeWidth={s * 0.03} opacity={0.35} />
    </g>
  );
}

/** A loose pen loop, the way you'd circle a spot on a map (as on the board). */
function inkLoop(cx: number, cy: number, r: number, seed: number) {
  const n = 9;
  let d = "";
  for (let i = 0; i <= n + 1; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    const rr = r * (1 + 0.07 * Math.sin(i * 2.3 + seed * 3) + (i > n ? 0.08 : 0));
    const x = cx + rr * Math.cos(a);
    const y = cy + rr * Math.sin(a) * 0.96;
    d += i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

function Cross({ x, y, k, color = "var(--threat)", width = 2.4 }: { x: number; y: number; k: number; color?: string; width?: number }) {
  return <path d={`M${n1(x - k)} ${n1(y - k)} L${n1(x + k)} ${n1(y + k)} M${n1(x + k)} ${n1(y - k)} L${n1(x - k)} ${n1(y + k)}`} stroke={color} strokeWidth={width} strokeLinecap="round" fill="none" />;
}

/** A pen arrowhead at (x, y) pointing along angle a (radians). */
function head(x: number, y: number, a: number, len = 7) {
  const p = (d: number) => `${n1(x - len * Math.cos(a + d))} ${n1(y - len * Math.sin(a + d))}`;
  return `M${p(0.5)} L${n1(x)} ${n1(y)} L${p(-0.5)}`;
}

/* ---- One Hive: lift the pinned piece and the hive cracks in two ---------------- */

export function OneHiveSketch({ width = 136 }: { width?: number }) {
  const s = 18;
  const css = `
.rs-oh-m{transform:translate(0,-20px);animation:rs-oh-m 5s ease-in-out infinite}
@keyframes rs-oh-m{0%,14%{transform:translate(0,0)}26%{transform:translate(0,-20px)}47%{transform:translate(0,-23px)}68%{transform:translate(0,-20px)}80%,100%{transform:translate(0,0)}}
.rs-oh-l{transform:translate(-3px,1.7px);animation:rs-oh-l 5s ease-in-out infinite}
@keyframes rs-oh-l{0%,26%{transform:none}34%,68%{transform:translate(-3px,1.7px)}78%,100%{transform:none}}
.rs-oh-r{transform:translate(3px,-1.7px);animation:rs-oh-r 5s ease-in-out infinite}
@keyframes rs-oh-r{0%,26%{transform:none}34%,68%{transform:translate(3px,-1.7px)}78%,100%{transform:none}}
.rs-oh-c{animation:rs-oh-c 5s ease-out infinite}
@keyframes rs-oh-c{0%,25%{stroke-dashoffset:1;opacity:1}35%,68%{stroke-dashoffset:0;opacity:1}75%{stroke-dashoffset:0;opacity:0}100%{stroke-dashoffset:1;opacity:0}}
.rs-oh-h{animation:rs-oh-h 5s ease-in-out infinite}
@keyframes rs-oh-h{0%,15%{opacity:0}24%,70%{opacity:1}79%,100%{opacity:0}}
`;
  return (
    <Sketch vb={[-56, -52, 112, 100]} width={width} css={css} label="Lifting the piece that joins two halves of the hive would split it, so that piece is pinned" caption="lift it: the hive splits">
      <g className="rs-oh-l">
        <Tile q={-1} r={0} s={s} bug="Q" color="w" seed={3} />
        <Tile q={-1} r={1} s={s} bug="G" color="b" seed={8} />
      </g>
      <g className="rs-oh-r">
        <Tile q={1} r={0} s={s} bug="A" color="b" seed={2} />
        <Tile q={1} r={-1} s={s} bug="Q" color="b" seed={9} />
      </g>
      <g className="rs-oh-h">
        <Cell x={0} y={0} s={s} seed={4} />
      </g>
      <path className="rs-oh-c draw" pathLength={1} d="M-13 -24 L-4 -13 L-9 -5 L2 2 L-3 9 L7 14 L12 24" fill="none" stroke="var(--threat)" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
      <g className="rs-oh-m">
        <Tile q={0} r={0} s={s} bug="S" color="w" seed={5} />
      </g>
    </Sketch>
  );
}

/* ---- Freedom to Move: an Ant tries the gap and bumps back --------------------- */

export function GateSketch({ width = 136 }: { width?: number }) {
  const s = 18;
  const [tx, ty] = at(1, 0, s);
  const [gx] = at(1, -1, s);
  const css = `
.rs-gt-m{animation:rs-gt-m 4.2s ease-in-out infinite}
@keyframes rs-gt-m{0%,16%{transform:none}32%{transform:translate(8px,0)}35%{transform:translate(4.5px,0)}38%{transform:translate(7.5px,0)}42%{transform:translate(5.5px,0)}50%{transform:translate(6px,0)}66%,100%{transform:none}}
.rs-gt-x{animation:rs-gt-x 4.2s ease-out infinite}
@keyframes rs-gt-x{0%,33%{opacity:0;transform:scale(.4)}38%{opacity:1;transform:scale(1.15)}42%,86%{opacity:1;transform:scale(1)}94%,100%{opacity:0;transform:scale(1)}}
.rs-gt-b{animation:rs-gt-b 4.2s ease-out infinite}
@keyframes rs-gt-b{0%,31%{opacity:0}34%,52%{opacity:1}62%,100%{opacity:0}}
`;
  const bump = (y: number, dir: number) => `M${n1(gx + 3)} ${n1(y)} l6 ${dir * 3} M${n1(gx + 4)} ${n1(y + dir * 5)} l5 ${dir * 6} M${n1(gx - 1)} ${n1(y + dir * 7)} l1 ${dir * 7}`;
  return (
    <Sketch vb={[-54, -50, 112, 100]} width={width} css={css} label="A sliding piece can't squeeze through a gap between two pieces" caption="too tight to slip in">
      <Cell x={tx} y={ty} s={s} seed={6} />
      <Tile q={-1} r={0} s={s} bug="Q" color="w" seed={1} />
      <g className="rs-gt-m">
        <Tile q={0} r={0} s={s} bug="A" color="b" seed={7} />
      </g>
      <Tile q={1} r={-1} s={s} bug="B" color="w" seed={4} />
      <Tile q={0} r={1} s={s} bug="S" color="w" seed={12} />
      <path className="rs-gt-b" d={bump(-9, -1) + " " + bump(9, 1)} stroke="var(--threat)" strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <g className="rs-gt-x fb">
        <Cross x={tx + 2} y={ty} k={6} />
      </g>
    </Sketch>
  );
}

/* ---- Pillbug throw, then the thrown piece is stunned -------------------------- */

export function StunSketch({ width = 140 }: { width?: number }) {
  const s = 18;
  const [ox, oy] = at(-1, 0, s);
  const [lx, ly] = at(1, 0, s);
  const D = lx - ox;
  // The throw follows a parabola over the Pillbug.
  const arc = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
  const times = [12, 17, 22, 27, 31, 35, 39, 43, 47];
  const frames = arc.map((t, i) => `${times[i]}%{transform:translate(${n1(D * t)}px,${n1(-40 * (1 - (2 * t - 1) ** 2))}px)}`).join("");
  const orbit = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return `${n1(i * 12.5)}%{transform:translate(${n1(11 * Math.cos(a))}px,${n1(3.6 * Math.sin(a))}px)}`;
  }).join("");
  const css = `
.rs-st-v{transform:translate(${n1(D)}px,0);animation:rs-st-v 5s linear infinite}
@keyframes rs-st-v{0%{transform:translate(0,0);opacity:1}${frames}49%{transform:translate(${n1(D)}px,-2px)}51%,84%{transform:translate(${n1(D)}px,0);opacity:1}89%{transform:translate(${n1(D)}px,0);opacity:0}90%{transform:translate(0,0);opacity:0}96%,100%{transform:translate(0,0);opacity:1}}
.rs-st-p{animation:rs-st-p 5s ease-in-out infinite}
@keyframes rs-st-p{0%,6%{transform:scale(1)}11%{transform:scale(.92)}16%{transform:scale(1.05)}21%,100%{transform:scale(1)}}
.rs-st-after{animation:rs-st-after 5s ease-in-out infinite}
@keyframes rs-st-after{0%,46%{opacity:0}52%,84%{opacity:1}89%,100%{opacity:0}}
.rs-st-home{animation:rs-st-home 5s ease-in-out infinite}
@keyframes rs-st-home{0%,13%{opacity:0}20%,88%{opacity:1}94%,100%{opacity:0}}
.rs-st-o{animation:rs-st-o 1.3s linear infinite}
@keyframes rs-st-o{${orbit}}
`;
  return (
    <Sketch vb={[-54, -64, 112, 112]} width={width} css={css} label="A Pillbug lifts a neighbour over itself; the thrown piece is stunned for a turn" caption="thrown, then stunned">
      <Tile q={0} r={1} s={s} bug="Q" color="w" seed={5} />
      <path d={`M${n1(ox + 4)} ${n1(oy - 16)} Q0 -66 ${n1(lx - 4)} ${n1(ly - 16)}`} fill="none" stroke="var(--line-strong)" strokeWidth={1.3} strokeDasharray="2 4" strokeLinecap="round" />
      <path d={head(lx - 4, ly - 16, 1.05, 6)} fill="none" stroke="var(--line-strong)" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      <g className="rs-st-home">
        <Cell x={ox} y={oy} s={s} seed={2} />
      </g>
      <g className="rs-st-after">
        <path d={sketchHexPath(lx, ly, s * 1.06, 9, 0.06)} fill="var(--accent)" fillOpacity={0.38} />
      </g>
      <g className="rs-st-p fb">
        <Tile q={0} r={0} s={s} bug="P" color="w" seed={11} />
      </g>
      <g transform={`translate(${n1(ox)} ${n1(oy)})`}>
        <g className="rs-st-v">
          <PieceTile bug="A" color="b" x={0} y={0} size={s} seed={3} />
        </g>
      </g>
      <g className="rs-st-after" transform={`translate(${n1(lx)} ${n1(ly - 21)})`}>
        <ellipse rx={11} ry={3.6} fill="none" stroke="var(--muted)" strokeWidth={0.9} strokeDasharray="1.5 2.5" />
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <g key={i} className="rs-st-o" style={{ transform: `translate(${n1(11 * Math.cos(a))}px,${n1(3.6 * Math.sin(a))}px)`, animationDelay: `${n1(-i * 0.433)}s` }}>
              <path d="M0 -3.4 Q.6 -.6 3.4 0 Q.6 .6 0 3.4 Q-.6 .6 -3.4 0 Q-.6 -.6 0 -3.4Z" fill="var(--accent)" stroke="var(--accent-strong)" strokeWidth={0.6} />
            </g>
          );
        })}
      </g>
    </Sketch>
  );
}

/* ---- Stacks: a Beetle climbs on, owns the stack, climbs off ------------------- */

export function StackSketch({ width = 140 }: { width?: number }) {
  const s = 18;
  const [qx] = at(0, 0, s);
  const [bx] = at(-1, 0, s);
  const D = qx - bx - 3;
  const css = `
.rs-sk-b{transform:translate(${n1(D)}px,-6px);animation:rs-sk-b 4.6s ease-in-out infinite}
@keyframes rs-sk-b{0%,14%{transform:none}19%{transform:translate(6px,-12px)}24%{transform:translate(15px,-19px)}29%{transform:translate(24px,-14px)}33%{transform:translate(${n1(D)}px,-5px)}35%{transform:translate(${n1(D)}px,-7px)}37%,64%{transform:translate(${n1(D)}px,-6px)}69%{transform:translate(20px,-17px)}73%{transform:translate(10px,-16px)}78%{transform:translate(0,1px)}80%,100%{transform:none}}
.rs-sk-n{animation:rs-sk-n 4.6s ease-out infinite}
@keyframes rs-sk-n{0%,34%{opacity:0;transform:scale(.3)}39%{opacity:1;transform:scale(1.2)}42%,63%{opacity:1;transform:scale(1)}67%,100%{opacity:0;transform:scale(1)}}
`;
  return (
    <Sketch vb={[-54, -46, 112, 74]} width={width} css={css} label="A Beetle climbs onto a piece; only the top piece of a stack can move and the stack takes its colour" caption="top bug owns the stack">
      <Tile q={0} r={0} s={s} bug="Q" color="w" seed={6} />
      <Tile q={1} r={0} s={s} bug="G" color="w" seed={13} />
      <g transform={`translate(${n1(bx)} 0)`}>
        <g className="rs-sk-b">
          <PieceTile bug="B" color="b" x={0} y={0} size={s} seed={2} />
        </g>
      </g>
      <g className="rs-sk-n fb">
        <circle cx={qx + 9} cy={-20} r={6} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.4} />
        <text x={qx + 9} y={-20} textAnchor="middle" dy="0.36em" fontSize={10} fontWeight={700} fill="var(--ink)" fontFamily="var(--font-hand)">
          2
        </text>
      </g>
    </Sketch>
  );
}

/* ---- Passing: every option crossed out, the turn goes across ------------------ */

export function PassSketch({ width = 150 }: { width?: number }) {
  const s = 16;
  const wx = -30,
    wy = 8;
  const bx = 44,
    by = 8;
  const cells = [
    [wx - s * SQ3 * 0.5, wy - s * 1.5],
    [wx - s * SQ3, wy],
    [wx - s * SQ3 * 0.5, wy + s * 1.5],
  ];
  const css = `
.rs-ps-x{animation:rs-ps-x 4.8s ease-out infinite both}
@keyframes rs-ps-x{0%,6%{opacity:0;transform:scale(.3)}10%{opacity:1;transform:scale(1.2)}13%,84%{opacity:1;transform:scale(1)}90%,100%{opacity:0;transform:scale(1)}}
.rs-ps-w{animation:rs-ps-w 4.8s ease-in-out infinite}
@keyframes rs-ps-w{0%,26%{transform:none}28%{transform:translate(-2px,0)}30%{transform:translate(2px,0)}32%{transform:translate(-1.5px,0)}34%,100%{transform:none}}
.rs-ps-a{animation:rs-ps-a 4.8s ease-in-out infinite}
@keyframes rs-ps-a{0%,36%{stroke-dashoffset:1;opacity:1}50%,86%{stroke-dashoffset:0;opacity:1}92%{stroke-dashoffset:0;opacity:0}100%{stroke-dashoffset:1;opacity:0}}
.rs-ps-t{animation:rs-ps-t 4.8s ease-in-out infinite}
@keyframes rs-ps-t{0%,44%{opacity:0}50%,86%{opacity:1}92%,100%{opacity:0}}
.rs-ps-b{animation:rs-ps-b 4.8s ease-in-out infinite}
@keyframes rs-ps-b{0%,52%{transform:none}56%{transform:translate(0,-6px)}60%{transform:none}63%{transform:translate(0,-2px)}66%,100%{transform:none}}
`;
  const arc = `M${wx + 8} ${wy - 20} Q${(wx + bx) / 2} ${wy - 50} ${bx - 8} ${by - 20}`;
  return (
    <Sketch vb={[-78, -46, 140, 98]} width={width} css={css} label="With no legal move or placement, the player passes and the turn goes to the opponent" caption="nothing legal? pass">
      {cells.map(([x, y], i) => (
        <g key={i}>
          <Cell x={x} y={y} s={s} seed={i + 2} />
          <g className="rs-ps-x fb" style={{ animationDelay: `${i * 0.3}s` }}>
            <Cross x={x} y={y} k={4.5} width={2.1} />
          </g>
        </g>
      ))}
      <g className="rs-ps-w">
        <PieceTile bug="A" color="w" x={wx} y={wy} size={s} seed={4} />
      </g>
      <g className="rs-ps-b">
        <PieceTile bug="S" color="b" x={bx} y={by} size={s} seed={8} />
      </g>
      <path className="rs-ps-a draw" pathLength={1} d={arc} fill="none" stroke="var(--ink-soft)" strokeWidth={1.6} strokeLinecap="round" />
      <path className="rs-ps-t" d={head(bx - 8, by - 20, 0.85, 6)} fill="none" stroke="var(--ink-soft)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <text className="rs-ps-t" x={(wx + bx) / 2} y={wy - 39} textAnchor="middle" fontFamily="var(--font-hand)" fontSize={15} fill="var(--ink)">
        pass
      </text>
    </Sketch>
  );
}

/* ---- Draw: one piece closes both Queens at once -------------------------------- */

export function DrawSketch({ width = 140 }: { width?: number }) {
  const s = 15;
  const ring: [number, number][] = [
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
    [2, -1],
    [2, 0],
    [1, 1],
  ];
  const [lx, ly] = at(1, -1, s);
  const [ax, ay] = at(0, 0, s);
  const [bx, by] = at(1, 0, s);
  const css = `
.rs-dr-l{animation:rs-dr-l 4.6s ease-in infinite}
@keyframes rs-dr-l{0%,10%{transform:translate(0,-24px);opacity:0}16%{opacity:1}24%{transform:translate(0,0)}26%{transform:translate(0,1.5px)}28%,86%{transform:none;opacity:1}92%,100%{transform:none;opacity:0}}
.rs-dr-o{animation:rs-dr-o 4.6s ease-in-out infinite}
@keyframes rs-dr-o{0%,28%{stroke-dashoffset:1;opacity:1}42%,86%{stroke-dashoffset:0;opacity:1}92%{stroke-dashoffset:0;opacity:0}100%{stroke-dashoffset:1;opacity:0}}
`;
  return (
    <Sketch vb={[-46, -44, 118, 86]} width={width} css={css} label="If one move surrounds both Queens, the game is a draw" caption="both at once: a draw">
      {ring.map(([q, r], i) => {
        const [x, y] = at(q, r, s);
        return <Blank key={i} x={x} y={y} s={s} seed={i * 5 + 1} />;
      })}
      <Tile q={0} r={0} s={s} bug="Q" color="w" seed={3} />
      <Tile q={1} r={0} s={s} bug="Q" color="b" seed={7} />
      <g className="rs-dr-l">
        <Blank x={lx} y={ly} s={s} seed={40} />
      </g>
      <path className="rs-dr-o draw" pathLength={1} d={inkLoop(ax, ay, s * 0.62, 1)} fill="none" stroke="var(--threat)" strokeWidth={2} strokeLinecap="round" />
      <path className="rs-dr-o draw" pathLength={1} d={inkLoop(bx, by, s * 0.62, 4)} fill="none" stroke="var(--threat)" strokeWidth={2} strokeLinecap="round" />
    </Sketch>
  );
}

/* ---- Tap an opponent's piece to see its reach --------------------------------- */

export function ReachSketch({ width = 140 }: { width?: number }) {
  const s = 16;
  const [ax, ay] = at(1, -1, s);
  const spots: [number, number][] = [
    [0, -1],
    [-1, 0],
    [0, 1],
    [1, 0],
  ];
  const tip = [n1(ax + 2), n1(ay + 3)];
  const css = `
.rs-rc-p{transform:translate(${tip[0]}px,${tip[1]}px);animation:rs-rc-p 4.8s ease-in-out infinite}
@keyframes rs-rc-p{0%{transform:translate(46px,34px);opacity:0}8%{opacity:1}26%{transform:translate(${tip[0]}px,${tip[1]}px) scale(1)}29%{transform:translate(${tip[0]}px,${tip[1]}px) scale(.82)}32%,66%{transform:translate(${tip[0]}px,${tip[1]}px) scale(1);opacity:1}80%{transform:translate(46px,34px);opacity:0}100%{transform:translate(46px,34px);opacity:0}}
.rs-rc-r{opacity:0;animation:rs-rc-r 4.8s ease-out infinite}
@keyframes rs-rc-r{0%,28%{opacity:0;transform:scale(.5)}30%{opacity:.9;transform:scale(.6)}42%,100%{opacity:0;transform:scale(1.5)}}
.rs-rc-s{animation:rs-rc-s 4.8s ease-out infinite}
@keyframes rs-rc-s{0%,29%{opacity:0}32%,86%{opacity:1}92%,100%{opacity:0}}
.rs-rc-t{animation:rs-rc-t 4.8s ease-out infinite both}
@keyframes rs-rc-t{0%,33%{opacity:0;transform:scale(.4)}38%{opacity:1;transform:scale(1.15)}41%,86%{opacity:1;transform:scale(1)}92%,100%{opacity:0;transform:scale(1)}}
`;
  return (
    <Sketch vb={[-48, -44, 104, 86]} width={width} css={css} label="Tapping an opponent's piece shows, in dashed red, where it could go on their next turn" caption="tap theirs: see its reach">
      <Tile q={0} r={0} s={s} bug="Q" color="w" seed={2} />
      <Tile q={-1} r={1} s={s} bug="G" color="w" seed={9} />
      <Tile q={1} r={-1} s={s} bug="A" color="b" seed={5} />
      <g className="rs-rc-s">
        <path d={sketchHexPath(ax, ay, s * 1.06, 21, 0.035)} fill="none" stroke="var(--select)" strokeWidth={2.2} strokeLinejoin="round" />
      </g>
      <g className="rs-rc-r fb">
        <circle cx={ax} cy={ay} r={s * 0.9} fill="none" stroke="var(--ink-soft)" strokeWidth={1.4} />
      </g>
      {spots.map(([q, r], i) => {
        const [x, y] = at(q, r, s);
        return (
          <g key={i} className="rs-rc-t fb" style={{ animationDelay: `${i * 0.18}s` }}>
            <path d={inkLoop(x, y, s * 0.4, i)} fill="none" stroke="var(--threat)" strokeWidth={2.1} strokeDasharray="2 4.5" strokeLinecap="round" />
          </g>
        );
      })}
      <g className="rs-rc-p">
        <path d="M0 0 L0 15 L3.8 11.2 L6.6 17.4 L9.4 16.1 L6.7 10 L11.6 10 Z" fill="var(--card)" stroke="var(--ink)" strokeWidth={1.4} strokeLinejoin="round" />
      </g>
    </Sketch>
  );
}

/* ---- Hint: the engine sketches a violet arrow --------------------------------- */

export function HintSketch({ width = 140 }: { width?: number }) {
  const s = 16;
  const [gx, gy] = at(-1, 0, s);
  const [tx, ty] = at(2, 0, s);
  const cx = (gx + tx) / 2,
    cy = -50;
  const ex = tx - 3,
    ey = ty - 11;
  const css = `
.rs-hn-a{animation:rs-hn-a 4.4s ease-in-out infinite}
@keyframes rs-hn-a{0%,10%{stroke-dashoffset:1;opacity:.9}38%,86%{stroke-dashoffset:0;opacity:.9}93%{stroke-dashoffset:0;opacity:0}100%{stroke-dashoffset:1;opacity:0}}
.rs-hn-h{animation:rs-hn-h 4.4s ease-in-out infinite}
@keyframes rs-hn-h{0%,36%{opacity:0}40%,86%{opacity:.9}93%,100%{opacity:0}}
.rs-hn-l{animation:rs-hn-l 4.4s ease-in-out infinite}
@keyframes rs-hn-l{0%,40%{stroke-dashoffset:1;opacity:1}56%,86%{stroke-dashoffset:0;opacity:1}93%{stroke-dashoffset:0;opacity:0}100%{stroke-dashoffset:1;opacity:0}}
`;
  return (
    <Sketch vb={[-48, -54, 124, 74]} width={width} css={css} label="The Hint button draws a violet arrow suggesting a move" caption="a nudge from the engine">
      <Tile q={0} r={0} s={s} bug="Q" color="w" seed={4} />
      <Tile q={1} r={0} s={s} bug="Q" color="b" seed={10} />
      <Cell x={tx} y={ty} s={s} seed={6} />
      <Tile q={-1} r={0} s={s} bug="G" color="w" seed={1} />
      <path className="rs-hn-a draw" pathLength={1} d={`M${n1(gx + 2)} ${n1(gy - 12)} Q${n1(cx)} ${cy} ${n1(ex)} ${n1(ey)}`} fill="none" stroke="var(--violet)" strokeWidth={3} strokeLinecap="round" />
      <path className="rs-hn-h" d={head(ex, ey, Math.atan2(ey - cy, ex - cx), 8)} fill="none" stroke="var(--violet)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <path className="rs-hn-l draw" pathLength={1} d={inkLoop(tx, ty, s * 0.62, 2)} fill="none" stroke="var(--violet)" strokeWidth={2.6} strokeLinecap="round" />
    </Sketch>
  );
}

/* ---- Placing: the Queen must be down by your fourth turn ---------------------- */

export function QueenDeadlineSketch({ width = 176, turns = 4, label, className }: { width?: number; turns?: number; label?: string; className?: string }) {
  const s = 16;
  const bugs: BugLetter[] = ["S", "A", "G", "B"].slice(0, turns - 1) as BugLetter[];
  bugs.push("Q");
  const span = 5.6;
  const step = 15;
  const css = bugs
    .map((_, i) => {
      const t = 6 + i * step;
      return `.rs-qd-${turns}-${i}{animation:rs-qd-${turns}-${i} ${span}s ease-in infinite}
@keyframes rs-qd-${turns}-${i}{0%,${t}%{transform:translate(0,-18px);opacity:0}${t + 3}%{opacity:1}${t + 7}%{transform:translate(0,0)}${t + 8}%{transform:translate(0,1.5px)}${t + 9}%,86%{transform:none;opacity:1}92%,100%{transform:none;opacity:0}}`;
    })
    .join("\n");
  const last = bugs.length - 1;
  const w = (turns - 1) * s * SQ3;
  return (
    <Sketch
      vb={[-s - 4, -s - 6, w + 2 * s + 8, 2 * s + 28]}
      width={width}
      css={css}
      className={className}
      label={label ?? `Your Queen must be placed by your turn ${turns}`}
      caption={`Queen down by turn ${turns}`}
    >
      {bugs.map((bug, i) => {
        const [x] = at(i, 0, s);
        const isQ = i === last;
        return (
          <g key={i}>
            <Cell x={x} y={0} s={s} seed={i + 3} stroke={isQ ? "var(--accent-strong)" : "var(--line-strong)"} />
            <text x={x} y={s + 15} textAnchor="middle" fontFamily="var(--font-hand)" fontSize={14} fill={isQ ? "var(--ink)" : "var(--muted)"} fontWeight={isQ ? 700 : 400}>
              {i + 1}
            </text>
            <g className={`rs-qd-${turns}-${i}`}>
              {isQ && <path d={sketchHexPath(x, 0, s * 1.08, 9, 0.06)} fill="var(--accent)" fillOpacity={0.38} />}
              <PieceTile bug={bug} color="w" x={x} y={0} size={s} seed={i * 7 + 2} />
            </g>
          </g>
        );
      })}
    </Sketch>
  );
}

/* ---- Notation: the six direction marks around a reference piece --------------- */

export function NotationCompass({ width = 168, className }: { width?: number; className?: string }) {
  const s = 22;
  // UHP: suffix marks point right (E, NE, SE), prefix marks point left (W, SW, NW).
  const dirs: [number, number, string][] = [
    [1, 0, "wQ-"],
    [0, 1, "wQ\\"],
    [-1, 1, "/wQ"],
    [-1, 0, "-wQ"],
    [0, -1, "\\wQ"],
    [1, -1, "wQ/"],
  ];
  const css = `
.rs-nc{opacity:0;animation:rs-nc 4.8s ease-in-out infinite both}
@keyframes rs-nc{0%{opacity:0}4%,15%{opacity:1}20%,100%{opacity:0}}
`;
  return (
    <Sketch vb={[-64, -58, 128, 116]} width={width} css={css} className={className} label="Direction marks around the White Queen: wQ- right, wQ/ up-right, wQ\ down-right, -wQ left, /wQ down-left, \wQ up-left">
      {dirs.map(([q, r, t], i) => {
        const [x, y] = at(q, r, s);
        return (
          <g key={t}>
            <g className="rs-nc" style={{ animationDelay: `${i * 0.8}s` }}>
              <path d={sketchHexPath(x, y, s * 0.92, i + 20, 0.06)} fill="var(--accent)" fillOpacity={0.32} />
            </g>
            <Cell x={x} y={y} s={s} seed={i + 5} />
            <text x={x} y={y} dy="0.35em" textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={600} fill="var(--ink-soft)">
              {t}
            </text>
          </g>
        );
      })}
      <PieceTile bug="Q" color="w" x={0} y={0} size={s} seed={3} />
    </Sketch>
  );
}

/* ---- Variants: little static vignettes for the rules drawer ------------------- */

export function LiteVignette() {
  const s = 12;
  const bugs: BugLetter[] = ["Q", "S", "B", "G", "A", "A"];
  return (
    <Sketch vb={[-13, -13, 5 * s * SQ3 + 26, 26]} width={150} label="Hive Lite: one Queen, Spider, Beetle and Grasshopper, and two Ants">
      {bugs.map((b, i) => (
        <PieceTile key={i} bug={b} color="w" x={i * s * SQ3} y={0} size={s} seed={i * 3 + 1} />
      ))}
    </Sketch>
  );
}

export function SwarmVignette() {
  const s = 11;
  const around: [number, number][] = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
  ];
  const [ex, ey] = at(1, -1, s);
  return (
    <Sketch vb={[-30, -28, 92, 56]} width={92} label="Swarm: a Queen falls when five of her six sides are covered">
      {around.map(([q, r], i) => {
        const [x, y] = at(q, r, s);
        return <Blank key={i} x={x} y={y} s={s} seed={i * 4 + 2} />;
      })}
      <Cell x={ex} y={ey} s={s} seed={3} />
      <PieceTile bug="Q" color="b" x={0} y={0} size={s} seed={5} />
      <path d={inkLoop(0, 0, s * 0.62, 2)} fill="none" stroke="var(--threat)" strokeWidth={1.6} strokeLinecap="round" />
      <text x={48} y={5} textAnchor="middle" fontFamily="var(--font-hand)" fontSize={16} fontWeight={700} fill="var(--threat)">
        5/6
      </text>
    </Sketch>
  );
}

export function SundownVignette() {
  const rays = [-160, -128, -96, -64, -32];
  return (
    <Sketch vb={[-44, -24, 88, 44]} width={92} label="Sundown: a turn limit">
      <path d="M-14 9 A14 14 0 0 1 14 9" fill="var(--accent)" fillOpacity={0.55} stroke="var(--accent-strong)" strokeWidth={1.6} />
      {rays.map((a) => {
        const r = ((a + 6) * Math.PI) / 180;
        return <path key={a} d={`M${n1(19 * Math.cos(r))} ${n1(9 + 19 * Math.sin(r))} L${n1(25 * Math.cos(r))} ${n1(9 + 25 * Math.sin(r))}`} stroke="var(--accent-strong)" strokeWidth={1.7} strokeLinecap="round" />;
      })}
      <path d="M-40 9.5 C -20 8, 0 11, 18 9 S 34 10, 40 9" fill="none" stroke="var(--ink-soft)" strokeWidth={1.7} strokeLinecap="round" />
      <path d="M-30 16 L-12 16 M-4 16 L14 16 M22 16 L32 16" stroke="var(--line-strong)" strokeWidth={1.3} strokeLinecap="round" strokeDasharray="2 3" />
    </Sketch>
  );
}

export function EarlyQueenVignette() {
  const s = 12;
  const bugs: BugLetter[] = ["S", "A", "Q"];
  return (
    <Sketch vb={[-14, -14, 2 * s * SQ3 + 28, 44]} width={94} label="Early Queen: the Queen must be placed by turn three">
      {bugs.map((b, i) => {
        const x = i * s * SQ3;
        return (
          <g key={i}>
            {b === "Q" && <path d={sketchHexPath(x, 0, s * 1.1, 9, 0.06)} fill="var(--accent)" fillOpacity={0.38} />}
            <PieceTile bug={b} color="w" x={x} y={0} size={s} seed={i * 5 + 2} />
            <text x={x} y={s + 13} textAnchor="middle" fontFamily="var(--font-hand)" fontSize={13} fill={b === "Q" ? "var(--ink)" : "var(--muted)"} fontWeight={b === "Q" ? 700 : 400}>
              {i + 1}
            </text>
          </g>
        );
      })}
    </Sketch>
  );
}

export function RepetitionVignette() {
  const s = 9;
  const gap = 48;
  const mini = (ox: number) => (
    <g transform={`translate(${ox} 0)`}>
      <PieceTile bug="Q" color="w" x={0} y={0} size={s} seed={1} />
      <PieceTile bug="A" color="b" x={s * SQ3} y={0} size={s} seed={2} />
      <PieceTile bug="G" color="w" x={s * SQ3 * 0.5} y={s * 1.5} size={s} seed={3} />
    </g>
  );
  const eq = (x: number) => <path d={`M${x - 3.5} 2.5 L${x + 3.5} 2 M${x - 3.5} 7 L${x + 3.5} 6.5`} stroke="var(--ink-soft)" strokeWidth={1.4} strokeLinecap="round" />;
  return (
    <Sketch vb={[-11, -11, 2 * gap + s * SQ3 + 22, 36]} width={150} label="Repetition draw: the same position three times is a draw">
      {mini(0)}
      {eq((s * SQ3 + gap) / 2)}
      {mini(gap)}
      {eq((s * SQ3 + gap) / 2 + gap)}
      {mini(gap * 2)}
    </Sketch>
  );
}

export function CountsVignette() {
  const s = 13;
  const btn = (x: number, sign: string) => (
    <g>
      <path d={sketchHexPath(x, 0, 8.5, x, 0.08)} fill="none" stroke="var(--ink-soft)" strokeWidth={1.3} />
      <path d={sign === "+" ? `M${x - 4} 0 L${x + 4} 0 M${x} -4 L${x} 4` : `M${x - 4} 0 L${x + 4} 0`} stroke="var(--ink)" strokeWidth={1.6} strokeLinecap="round" />
    </g>
  );
  return (
    <Sketch vb={[-15, -15, 106, 30]} width={106} label="Custom counts: choose how many of each bug">
      <PieceTile bug="A" color="w" x={0} y={0} size={s} seed={4} />
      {btn(30, "-")}
      <text x={52} y={0} dy="0.35em" textAnchor="middle" fontFamily="var(--font-hand)" fontSize={19} fontWeight={700} fill="var(--ink)">
        5
      </text>
      {btn(74, "+")}
    </Sketch>
  );
}
