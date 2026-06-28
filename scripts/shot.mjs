// Dev-only screenshot helper. Drives the already-installed Chrome via puppeteer-core
// with TRUE mobile emulation (so device-width === viewport, unlike raw --window-size).
// Usage: node scripts/shot.mjs <path> <outfile> [width] [height] [fullPage:0|1]
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [, , routePath = "/", out = "shot.png", w = "390", h = "844", full = "1"] = process.argv;
const width = Number(w);
const height = Number(h);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`http://localhost:5173${routePath}`, { waitUntil: "networkidle0", timeout: 30000 });
// settle for fonts/data
await new Promise((r) => setTimeout(r, 500));

const metrics = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
console.log(`${routePath} → ${out}  viewport=${width}  scrollWidth=${metrics.scrollWidth}  overflowX=${metrics.overflowX}`);

await page.screenshot({ path: out, fullPage: full === "1" });
await browser.close();
