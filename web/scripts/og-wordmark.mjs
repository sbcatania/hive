// Draws the Hive wordmark (components/Wordmark.tsx) to public/og/wordmark.png,
// with a transparent background, for the link-preview pictures (app/og/route.tsx).
// The pictures can't draw it themselves: its letters need Fraunces' variable
// axes, which the preview renderer doesn't support.
// Run after changing the wordmark: node scripts/og-wordmark.mjs (dev server not needed).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Playwright isn't a dependency; use a global install (npm i -g playwright).
const { chromium } = createRequire(join(process.execPath, "../../lib/node_modules/"))("playwright");
const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = execFileSync("npx", ["tsx", "--tsconfig", "tsconfig.json", "scripts/og-wordmark-svg.tsx"], { cwd: web, encoding: "utf8" });
const font = readFileSync(join(web, "node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2")).toString("base64");
const html = `<!doctype html><style>
@font-face { font-family: "Fraunces Variable"; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 100 900; }
:root { --font-display: "Fraunces Variable"; --tile-white: #ffffff; --tile-white-ink: #1f2023; --tile-black: #2b2c2f; --tile-black-rim: #0c0d0e; --tile-black-ink: #eceae6; }
html, body { margin: 0; background: transparent; } svg { display: block; width: 1000px; height: auto; }
</style>${svg}`;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
mkdirSync(join(web, "public/og"), { recursive: true });
await page.locator("svg").screenshot({ path: join(web, "public/og/wordmark.png"), omitBackground: true });
await browser.close();
console.log("public/og/wordmark.png");
