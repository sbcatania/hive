import type { MetadataRoute } from "next";

// Lets the site be added to a phone's home screen and open full-screen, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hive",
    short_name: "Hive",
    description: "Play Hive against the computer, on one device, or online with a friend.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#fafaf9",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
