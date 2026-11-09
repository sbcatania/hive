import type { Metadata } from "next";
import { gamePreview, previewMetadata } from "@/lib/preview";
import OnlinePage from "./OnlineClient";

// A shared game link (/online?g=<id>) unfurls as an invitation while the game
// waits for a second player, and names the players once it's on.
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ g?: string }> }): Promise<Metadata> {
  const { g } = await searchParams;
  const preview = g ? await gamePreview(g) : null;
  if (!preview) return { title: "Online game" };
  return previewMetadata(preview, `/online?g=${encodeURIComponent(g!)}`);
}

export default OnlinePage;
