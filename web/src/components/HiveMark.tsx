/** The site logo: three bakelite tiles forming a tiny hive, with a bee on top. */
export function HiveMark({ className }: { className?: string }) {
  const hex = (cx: number, cy: number, r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = ((60 * i - 90) * Math.PI) / 180;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <polygon points={hex(21, 40, 15)} fill="#2a2a2e" stroke="#0d0d10" strokeWidth="1.5" />
      <polygon points={hex(43, 40, 15)} fill="#f7f2e6" stroke="#bdb39c" strokeWidth="1.5" />
      <polygon points={hex(32, 21, 15)} fill="#f7f2e6" stroke="#bdb39c" strokeWidth="1.5" />
      <ellipse cx="32" cy="22" rx="5" ry="7.5" fill="#e8b225" stroke="#232020" strokeWidth="1.4" />
      <path d="M27.5 20.5h9M27.5 24h9" stroke="#232020" strokeWidth="1.8" />
      <ellipse cx="26.5" cy="17.5" rx="4.5" ry="2.6" fill="#fff" stroke="#232020" strokeWidth="1" opacity="0.9" transform="rotate(-30 26.5 17.5)" />
      <ellipse cx="37.5" cy="17.5" rx="4.5" ry="2.6" fill="#fff" stroke="#232020" strokeWidth="1" opacity="0.9" transform="rotate(30 37.5 17.5)" />
      <circle cx="32" cy="13.5" r="2.6" fill="#232020" />
    </svg>
  );
}
