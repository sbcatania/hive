import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hive — Play Online",
  description: "Play the board game Hive against the computer or a friend",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  );
}
