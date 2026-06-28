// Generate PWA icons from the brand compass mark (navy ground, amber/cream needle,
// pine hub) using the already-installed Chrome via puppeteer-core. Writes to public/.
import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = path.resolve(import.meta.dirname, "..");
const ICONS = path.join(ROOT, "public", "icons");
await mkdir(ICONS, { recursive: true });

const NAVY = "#082954";
const compass = (s) => `
  <svg width="${s}" height="${s}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="20" fill="none" stroke="#FAF8F5" stroke-width="2.5" opacity="0.5"/>
    <polygon points="32,13 39,32 32,29.5 25,32" fill="#C86604"/>
    <polygon points="32,51 25,32 32,34.5 39,32" fill="#FAF8F5"/>
    <circle cx="32" cy="32" r="3.2" fill="#2E6049"/>
  </svg>`;

// size, output file, corner radius %, mark scale (smaller = more padding/safe-zone)
const SPECS = [
  { size: 192, file: "icons/icon-192.png", radiusPct: 22, mark: 0.62 },
  { size: 512, file: "icons/icon-512.png", radiusPct: 22, mark: 0.62 },
  { size: 512, file: "icons/maskable-512.png", radiusPct: 0, mark: 0.5 }, // full-bleed safe zone
  { size: 180, file: "apple-touch-icon.png", radiusPct: 0, mark: 0.62 }, // iOS masks it
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();

for (const spec of SPECS) {
  const radius = Math.round((spec.radiusPct / 100) * spec.size);
  const mark = Math.round(spec.size * spec.mark);
  await page.setViewport({ width: spec.size, height: spec.size, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><html><body style="margin:0">
       <div style="width:${spec.size}px;height:${spec.size}px;background:${NAVY};border-radius:${radius}px;display:flex;align-items:center;justify-content:center">
         ${compass(mark)}
       </div>
     </body></html>`,
    { waitUntil: "domcontentloaded" },
  );
  await new Promise((r) => setTimeout(r, 80));
  await page.screenshot({ path: path.join(ROOT, "public", spec.file), clip: { x: 0, y: 0, width: spec.size, height: spec.size }, omitBackground: false });
  console.log(`wrote public/${spec.file} (${spec.size}px, r=${radius}, mark=${mark})`);
}

await browser.close();
