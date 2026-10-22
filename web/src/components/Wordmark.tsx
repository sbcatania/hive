import { PieceTile, sketchHexPath } from "./PieceTile";

// HIVE spelled on four game tiles in a straight hive line (pointy-top hexes touching
// edge to edge), alternating white and black like the two sides, with the Queen Bee
// tucked against the E as if the hive has just started to grow.
const R = 30;
const W = R * Math.sqrt(3);
const LETTERS = [
  { ch: "H", white: true, rot: -2 },
  { ch: "I", white: false, rot: 1.5 },
  { ch: "V", white: true, rot: -1 },
  { ch: "E", white: false, rot: 2 },
];
const QUEEN = { x: W * 3 + W / 2, y: R * 1.5 };

/** The Hive wordmark. `animate` sets the tiles down one by one (the page's single
 * entrance moment); leave it off where the mark is just a label. */
export function Wordmark({
  className,
  animate,
}: {
  className?: string;
  animate?: boolean;
}) {
  const pad = 5;
  const vb = [-W / 2 - pad, -R - pad, W * 4.5 + 2 * pad, R * 3.5 + 2 * pad];
  const set = (i: number, x: number, y: number) =>
    animate
      ? {
          className: "tile-set",
          style: {
            animationDelay: `${100 + i * 140}ms`,
            transformOrigin: `${x}px ${y}px`,
          },
        }
      : {};
  return (
    <svg
      viewBox={vb.join(" ")}
      className={className}
      role="img"
      aria-label="Hive"
    >
      {LETTERS.map((t, i) => {
        const x = i * W;
        const ink = t.white ? "var(--tile-white-ink)" : "var(--tile-black-ink)";
        return (
          <g key={t.ch} transform={`rotate(${t.rot} ${x} 0)`}>
            <g {...set(i, x, 0)}>
              <path
                d={sketchHexPath(x, 0, R * 0.97, i * 11 + 3, 0.035)}
                fill={t.white ? "var(--tile-white)" : "var(--tile-black)"}
                stroke={t.white ? "var(--tile-white-ink)" : "var(--tile-black-rim)"}
                strokeWidth={2.2}
                strokeLinejoin="round"
              />
              <path
                d={sketchHexPath(x, 0, R * 0.9, i * 11 + 7, 0.06)}
                fill="none"
                stroke={ink}
                strokeWidth={0.8}
                opacity={0.35}
              />
              <text
                x={x}
                y={0}
                dy="0.36em"
                textAnchor="middle"
                fontFamily="var(--font-display)"
                fontSize={R * 1.05}
                fontWeight={700}
                fill={ink}
                style={{
                  fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 72',
                }}
              >
                {t.ch}
              </text>
            </g>
          </g>
        );
      })}
      <g transform={`rotate(-6 ${QUEEN.x} ${QUEEN.y})`}>
        <g {...set(4, QUEEN.x, QUEEN.y)}>
          <PieceTile
            bug="Q"
            color="w"
            x={QUEEN.x}
            y={QUEEN.y}
            size={R * 1.04}
            seed={9}
          />
        </g>
      </g>
    </svg>
  );
}
