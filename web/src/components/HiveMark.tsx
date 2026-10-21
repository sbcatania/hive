import { sketchHexPath } from "./PieceTile";

/** The site logo: three pencilled cells of a hive with a bee drawn on top. */
export function HiveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d={sketchHexPath(43, 41, 14.5, 3, 0.05)} fill="var(--accent)" fillOpacity={0.35} stroke="var(--ink)" strokeWidth={1.8} strokeLinejoin="round" />
      <path d={sketchHexPath(20, 41, 14.5, 8, 0.05)} fill="var(--ink)" fillOpacity={0.82} stroke="var(--ink)" strokeWidth={1.8} strokeLinejoin="round" />
      <path d={sketchHexPath(31.5, 21.5, 14.5, 5, 0.05)} fill="var(--card)" stroke="var(--ink)" strokeWidth={1.8} strokeLinejoin="round" />
      <g stroke="var(--ink)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M27.4 16.5c-4-3.6-7.6-1.6-6.4 1.4 1 2.4 4.2 2.2 6.4.4M36 16.5c4-3.6 7.6-1.6 6.4 1.4-1 2.4-4.2 2.2-6.4.4" fill="var(--card)" strokeWidth={1.2} />
        <ellipse cx="31.7" cy="22.5" rx="4.6" ry="6.8" fill="#e2ad2e" strokeWidth={1.5} />
        <path d="M27.4 21h8.6M27.6 24.4h8.2" strokeWidth={1.7} />
        <circle cx="31.7" cy="14.6" r="2.4" fill="var(--ink)" strokeWidth={0} />
      </g>
    </svg>
  );
}
