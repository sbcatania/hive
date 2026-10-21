// One drawn icon set for every control: 24px grid, 1.9 stroke, round caps.
// Paths are deliberately a little organic so they sit with the sketchbook look.

const PATHS: Record<string, React.ReactNode> = {
  undo: <path d="M9 7 4.5 11 9 15M5 11h9.5a5 5 0 0 1 0 10H12" />,
  hint: (
    <>
      <path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2V18h5v-1.5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5Z" />
      <path d="M10 20.5h4" />
    </>
  ),
  flag: <path d="M6 21V4M6 4.5c3.5-1.8 6.5 1.8 10.5 0v8c-4 1.8-7-1.8-10.5 0" />,
  eval: (
    <>
      <path d="M12 4v16M7 20h10M5 8h14" />
      <path d="M5 8 2.5 14a3 3 0 0 0 5 0L5 8ZM19 8l-2.5 6a3 3 0 0 0 5 0L19 8Z" />
    </>
  ),
  draw: (
    <>
      <path d="m9 4.5 5 2.9v5.7l-5 2.9-5-2.9V7.4z" />
      <path d="m15 8.5 5 2.9v5.7l-5 2.9-5-2.9" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  close: <path d="M6 6.2 18 17.8M17.8 6 6.2 18" />,
  check: <path d="m4.5 12.5 4.5 4.5 10.5-11" />,
  play: <path d="M7.5 5v14l11-7z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  first: <path d="M6 5v14M18 6l-8 6 8 6" />,
  prev: <path d="m15 5.5-7 6.5 7 6.5" />,
  next: <path d="m9 5.5 7 6.5-7 6.5" />,
  last: <path d="M18 5v14M6 6l8 6-8 6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />,
  auto: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
    </>
  ),
  menu: <path d="M4 7h16M4 12.2h16M4 17.4h16" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20.5c1-4 4-5.8 7.5-5.8s6.5 1.8 7.5 5.8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.3 2" />
    </>
  ),
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />,
  chevron: <path d="m6 9.5 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  skip: <path d="M5 6l8 6-8 6zM17 5.5v13" />,
  share: <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />,
  hexes: (
    <>
      <path d="m8 3.5 4 2.3v4.6l-4 2.3-4-2.3V5.8z" />
      <path d="m16 8 4 2.3v4.6l-4 2.3-4-2.3v-4.6zM8 12.5l4 2.3v4.6L8 21.7l-4-2.3v-4.6z" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  bolt: <path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}
