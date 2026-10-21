import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hive — play online or against the computer",
  description: "Play the board game Hive with the Mosquito, Ladybug and Pillbug expansions: against CPU opponents, pass-and-play, or online with a friend.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f2e8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-[var(--line)] bg-[var(--bg)]/90 px-4 backdrop-blur">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <svg viewBox="-50 -50 100 100" className="h-7 w-7">
              <polygon points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23" fill="#e8b225" stroke="#7c5a0a" strokeWidth="5" />
              <polygon points="0,-22 19,-11 19,11 0,22 -19,11 -19,-11" fill="#fff6d8" />
            </svg>
            Hive
          </Link>
          <nav className="flex gap-4 text-sm text-[var(--muted)]">
            <Link href="/" className="hover:text-[var(--text)]">
              New game
            </Link>
            <Link href="/play" className="hover:text-[var(--text)]">
              Resume
            </Link>
            <Link href="/rules" className="hover:text-[var(--text)]">
              How to play
            </Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
