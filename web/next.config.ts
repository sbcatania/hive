import type { NextConfig } from "next";

// Hive moved to hive.sbc.me; send the old Vercel addresses there.
const oldHosts = ["hive-seven-gamma.vercel.app", "hive-sbcatania.vercel.app"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return oldHosts.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://hive.sbc.me/:path*",
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/wasm/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
