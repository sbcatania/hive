import type { Metadata } from "next";
import { playerPreview, previewMetadata } from "@/lib/preview";
import PlayerPage from "./PlayerClient";

// A player's link (/player?u=<name>) unfurls with their name and rating.
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ u?: string }> }): Promise<Metadata> {
  const { u } = await searchParams;
  const preview = u ? await playerPreview(u) : null;
  if (!preview) return { title: "Player" };
  return previewMetadata(preview, `/player?u=${encodeURIComponent(u!)}`);
}

export default PlayerPage;
