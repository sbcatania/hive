"use client";

import { Crash } from "@/components/Crash";

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fafaf9", color: "#1c1e21" }}>
        <Crash {...props} />
      </body>
    </html>
  );
}
