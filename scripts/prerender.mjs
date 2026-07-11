// Prerender the content pages (guides) to static HTML + generate sitemap.xml.
// Run AFTER `npm run build`:  node scripts/prerender.mjs   (or: npm run prerender)
//
// Serves dist/ with `vite preview`, walks each guide route with the installed
// Chrome (puppeteer-core, same pattern as shot.mjs), waits for the page's own
// <title> to land (usePageMeta), and writes dist/<slug>/index.html with a
// canonical link injected. Static hosts then serve real HTML to crawlers for
// every guide URL; the SPA takes over on load. English is the prerendered
// default (a fresh browser context has no rc.lang); Spanish renders client-side.
//
// SITE_ORIGIN overrides the canonical/sitemap origin at the Phase 3 cutover:
//   SITE_ORIGIN=https://redmondcompass.com node scripts/prerender.mjs
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { GUIDE_SLUGS } from "../src/features/guides/registry.ts";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ORIGIN = process.env.SITE_ORIGIN ?? "https://app.redmondcompass.com";
const PORT = 4319;
const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");

if (!existsSync(path.join(DIST, "index.html"))) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

// --- serve dist/ (vite preview gives us the SPA fallback for deep routes) ---
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: ROOT,
  stdio: "ignore",
});
const stop = () => server.kill();
process.on("exit", stop);
for (let i = 0; ; i++) {
  try {
    await fetch(`http://localhost:${PORT}/`);
    break;
  } catch {
    if (i > 40) throw new Error("vite preview did not start");
    await new Promise((r) => setTimeout(r, 250));
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

let ok = 0;
for (const slug of GUIDE_SLUGS) {
  await page.goto(`http://localhost:${PORT}/${slug}`, { waitUntil: "networkidle0", timeout: 30000 });
  // the guide's own meta landing (usePageMeta) is the "content is rendered" signal
  await page.waitForFunction(() => document.title.includes("|"), { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300)); // fonts settle
  let html = await page.evaluate(() => "<!doctype html>\n" + document.documentElement.outerHTML);
  html = html.replace("</head>", `<link rel="canonical" href="${ORIGIN}/${slug}">\n</head>`);
  const dir = path.join(DIST, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), html);
  const title = await page.title();
  console.log(`  ✓ /${slug}  →  dist/${slug}/index.html  (${title})`);
  ok++;
}
await browser.close();
stop();

// --- sitemap: core screens + every guide ---
const CORE = ["/", "/search", "/events", "/community", "/resources"];
const today = new Date().toISOString().slice(0, 10);
const urls = [...CORE, ...GUIDE_SLUGS.map((s) => `/${s}`)]
  .map((u) => `  <url><loc>${ORIGIN}${u === "/" ? "" : u}</loc><lastmod>${today}</lastmod></url>`)
  .join("\n");
writeFileSync(
  path.join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);
console.log(`Prerendered ${ok}/${GUIDE_SLUGS.length} guides + sitemap.xml (origin ${ORIGIN})`);
process.exit(0);
