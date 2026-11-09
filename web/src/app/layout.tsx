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
import { LAUNCH_SCRIPT, THEME_BOOT_SCRIPT } from "@/lib/theme-mode";
import { DialogProvider } from "@/components/Dialogs";
import { DESCRIPTION, SITE } from "@/lib/preview";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Hive — the board game, in your browser", template: "%s · Hive" },
  description: DESCRIPTION,
  applicationName: "Hive",
  // What a link shows in chats and posts. Online games and players have their
  // own (see lib/preview.ts); every other page uses the site's picture.
  openGraph: {
    type: "website",
    siteName: "Hive",
    title: "Hive — the board game, in your browser",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/og", width: 1200, height: 630, alt: "Hive: no board, no luck, just bugs." }],
  },
  twitter: { card: "summary_large_image", title: "Hive — the board game, in your browser", description: DESCRIPTION, images: ["/og"] },
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png" },
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
        {/* Launching from the home screen: the first frame repeats the launch image (the
            wordmark centred on plain paper), then the wordmark glides into the header's
            logo (see .launch and LAUNCH_SCRIPT). Its timing is pure CSS, so it always
            gets out of the way, even before the app has loaded. */}
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
        <script dangerouslySetInnerHTML={{ __html: LAUNCH_SCRIPT }} />
      </body>
    </html>
  );
}
