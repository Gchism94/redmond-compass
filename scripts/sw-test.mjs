// Verify the production service worker serves the app OFFLINE (run against `vite preview`).
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.argv[2] || ".";
const BASE = process.argv[3] || "http://localhost:4173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--hide-scrollbars"] });
const page = await b.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await sleep(1500);
console.log("SW controlling page:", await page.evaluate(() => !!navigator.serviceWorker.controller));

await page.setOfflineMode(true);
await page.reload({ waitUntil: "domcontentloaded" }).catch((e) => console.log("reload err", String(e).slice(0, 80)));
await sleep(800);
console.log("offline root renders app shell:", await page.evaluate(() => document.body.innerText.includes("Redmond Compass")));

await page.goto(`${BASE}/search`, { waitUntil: "domcontentloaded" }).catch((e) => console.log("nav err", String(e).slice(0, 80)));
await sleep(800);
console.log(
  "offline deep route /search renders:",
  await page.evaluate(() => document.body.innerText.includes("Browse by category") || document.body.innerText.includes("Trending")),
);
await page.screenshot({ path: `${OUT}/s8-offline-prod.png`, fullPage: false });
await b.close();
