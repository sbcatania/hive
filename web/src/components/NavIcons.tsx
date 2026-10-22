// Small coloured drawings for the site's sections, in the same ink-and-wash style as
// the new-game icons (with their faint second pencil pass). One beside each page in
// the menu.

import { Drawn, hex } from "./Sketchy";

const ink = "var(--ink)";
const honey = "var(--accent)";
const blue = "var(--move)";
const red = "var(--threat)";
const violet = "var(--violet)";

export type NavIconName = "play" | "learn" | "puzzles" | "journal" | "rankings";

const ICONS: Record<NavIconName, React.ReactNode> = {
  // A honey tile with a play mark.
  play: (
    <>
      <path d={hex(16, 15, 11.4, 4)} fill={honey} fillOpacity={0.55} stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M13.5 10.5v9l7-4.5z" fill={ink} stroke={ink} strokeWidth={1.2} strokeLinejoin="round" />
    </>
  ),
  // An open field guide with a blue ribbon.
  learn: (
    <>
      <path d="M16 8.5C13 6.5 8.5 6 4.5 6.5v16c4-.5 8.5 0 11.5 2 3-2 7.5-2.5 11.5-2v-16C23.5 6 19 6.5 16 8.5Z" fill="var(--card)" stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M16 8.5v16" stroke={ink} strokeWidth={1.5} />
      <path d="M8 11c2-.2 3.8 0 5 .6M8 14.5c2-.2 3.8 0 5 .6M19 11.6c1.2-.6 3-.8 5-.6" stroke={ink} strokeWidth={1.2} strokeLinecap="round" opacity={0.55} />
      <path d="M21 6.6v8l1.8-1.6 1.8 1.6V6.4" fill={blue} stroke={blue} strokeWidth={1} strokeLinejoin="round" />
    </>
  ),
  // A tile with a violet question mark.
  puzzles: (
    <>
      <path d={hex(16, 15, 11.4, 9)} fill="var(--card)" stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M12.8 12.3c0-2 1.5-3.3 3.3-3.3s3.2 1.2 3.2 2.9c0 2.4-3.1 2.6-3.1 5" fill="none" stroke={violet} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx="16.2" cy="20.4" r="1.4" fill={violet} />
    </>
  ),
  // A spiral-bound notebook with a red bookmark.
  journal: (
    <>
      <path d="M9.9 4.6c4.1-.2 8.2-.2 12.3 0 1.4.1 2.3 1 2.4 2.4.2 5.8.2 11.6 0 17.4-.1 1.4-1 2.3-2.4 2.3-4.1.2-8.2.2-12.3 0-1.4-.1-2.3-1-2.4-2.4-.2-5.8-.2-11.6 0-17.4.1-1.3 1-2.2 2.4-2.3Z" fill="var(--card)" stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M5.5 9h4M5.5 14h4M5.5 19h4" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M13 11h7M13 15h7M13 19h4.5" stroke={ink} strokeWidth={1.2} strokeLinecap="round" opacity={0.55} />
      <path d="M19.5 4.5v7l2-1.6 2 1.6v-7" fill={red} stroke={red} strokeWidth={1} strokeLinejoin="round" />
    </>
  ),
  // A honey trophy.
  rankings: (
    <>
      <path d="M10 5h12v5.5a6 6 0 0 1-12 0Z" fill={honey} fillOpacity={0.7} stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M10 7.5H6.5c0 3.2 1.5 5 4 5.2M22 7.5h3.5c0 3.2-1.5 5-4 5.2" fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M16 16.5v4M11.5 26h9l-1-5.5h-7z" fill="var(--card)" stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="m16 7.6.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" fill="var(--card)" />
    </>
  ),
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg viewBox="0 0 32 30" className={className ?? "h-7 w-7"} aria-hidden>
      <Drawn>{ICONS[name]}</Drawn>
    </svg>
  );
}
