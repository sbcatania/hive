import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource/alegreya-sans/400.css";
import "@fontsource/alegreya-sans/500.css";
import "@fontsource/alegreya-sans/700.css";
import "@fontsource/caveat/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthProvider } from "@/lib/auth";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-mode";

export const metadata: Metadata = {
  title: { default: "Hive — the board game, in your browser", template: "%s · Hive" },
  description:
    "Play Hive with the Mosquito, Ladybug and Pillbug: against four CPU opponents, pass-and-play, or online with a friend. Rated games, puzzles and an illustrated field guide to the rules.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2ead8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f2338" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <AuthProvider>
          <SiteHeader />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
