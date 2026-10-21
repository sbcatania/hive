import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource/alegreya-sans/400.css";
import "@fontsource/alegreya-sans/500.css";
import "@fontsource/alegreya-sans/700.css";
import "@fontsource/caveat/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import splash from "@/lib/splash.json";
import { SiteHeader } from "@/components/SiteHeader";
import { NativeFeel } from "@/components/NativeFeel";
import { Wordmark } from "@/components/Wordmark";
import { AuthProvider } from "@/lib/auth";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-mode";
import { DialogProvider } from "@/components/Dialogs";

export const metadata: Metadata = {
  title: { default: "Hive — the board game, in your browser", template: "%s · Hive" },
  description:
    "Play Hive with the Mosquito, Ladybug and Pillbug: against four CPU opponents, pass-and-play, or online with a friend. Rated games, puzzles and an illustrated field guide to the rules.",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  // Launch screens per iPhone size and theme (made by the splash script), so a
  // home-screen launch never flashes white.
  appleWebApp: { capable: true, title: "Hive", startupImage: splash },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#17181a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {/* The pencil: every outlined surface is drawn through this, so edges wobble like a hand-drawn line. */}
        <svg width="0" height="0" className="absolute" aria-hidden>
          <filter id="pencil" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="1" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        {/* Launching from the home screen: the first frame repeats the launch image (the
            wordmark centred on plain paper), then dissolves into the app. CSS-only, so it
            needs no JavaScript and always gets out of the way. */}
        <div className="launch" aria-hidden>
          <Wordmark className="launch-mark" />
        </div>
        <NativeFeel />
        <AuthProvider>
          <DialogProvider>
            <SiteHeader />
            <main>{children}</main>
          </DialogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
