// Phase 0.2 — content-page inventory of the live Base44 site (redmondcompass.com).
// The site is a SPA, so we render each route in headless Chrome, extract the copy as
// markdown, download every referenced image, and keep a full-page screenshot as visual
// insurance. Output: migration/content/<route>.md + assets/ + screenshots/ + inventory.
// Usage: node migration/scripts/crawl-content.mjs [/extra-route ...]
//   With route args: captures ONLY those routes (discovery skipped) — used for pages
//   not linked from the homepage (e.g. /new-to-the-area, /ember).
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const ORIGIN = "https://redmondcompass.com";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "migration", "content");
mkdirSync(path.join(OUT, "assets"), { recursive: true });
mkdirSync(path.join(OUT, "screenshots"), { recursive: true });

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const slugOf = (route) => (route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-zA-Z0-9-]+/g, "-"));

// In-page DOM → markdown extractor (runs in the browser context).
const extractMd = () => {
  const md = [];
  const walk = (node) => {
    if (node.nodeType !== 1) return;
    const el = node;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return;
    const tag = el.tagName.toLowerCase();
    const text = () => el.innerText.trim().replace(/\n{2,}/g, "\n");
    if (/^h[1-6]$/.test(tag)) { if (text()) md.push(`${"#".repeat(+tag[1])} ${text()}`); return; }
    if (tag === "p" || tag === "blockquote") { if (text()) md.push(tag === "blockquote" ? `> ${text()}` : text()); return; }
    if (tag === "li") { if (text()) md.push(`- ${text()}`); return; }
    if (tag === "img") {
      const src = el.currentSrc || el.src;
      if (src && !src.startsWith("data:")) md.push(`![${el.alt || ""}](${src})`);
      return;
    }
    if (tag === "a" && el.href && el.children.length === 0) {
      const t = el.innerText.trim();
      if (t) md.push(`[${t}](${el.getAttribute("href")})`);
      return;
    }
    if (["script", "style", "nav", "svg", "noscript", "iframe"].includes(tag)) return;
    for (const child of el.childNodes) walk(child);
  };
  walk(document.querySelector("main") ?? document.body);
  const imgs = [...document.images].map((i) => i.currentSrc || i.src).filter((s) => s && !s.startsWith("data:"));
  return { md: md.join("\n\n"), title: document.title, imgs: [...new Set(imgs)] };
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

// 1) routes: explicit args, or discover from the homepage (nav + footer + body links)
const extra = process.argv.slice(2).filter((a) => a.startsWith("/"));
let routes;
if (extra.length) {
  routes = new Set(extra);
  console.log(`capturing ${routes.size} explicit routes:`, [...routes].join("  "));
} else {
  await page.goto(ORIGIN, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  const discovered = await page.evaluate(() =>
    [...document.querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href"))
      .filter((h) => h && (h.startsWith("/") || h.startsWith(location.origin))),
  );
  routes = new Set(["/"]);
  for (let h of discovered) {
    h = h.replace(ORIGIN, "");
    const clean = h.split("#")[0];
    if (!clean) continue;
    // keep static/list routes; detail routes with ids become redirect-map entries, not copies
    if (/[?&](id|business|event)=/i.test(clean)) continue;
    routes.add(clean.split("?")[0]);
  }
  console.log(`discovered ${routes.size} routes:`, [...routes].join("  "));
}

// 2) capture each route
const inventory = [];
for (const route of [...routes].sort()) {
  const slug = slugOf(route);
  try {
    await page.goto(`${ORIGIN}${route}`, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1200));
    const { md, title, imgs } = await page.evaluate(extractMd);
    // download images
    const localImgs = [];
    for (const src of imgs) {
      try {
        const ext = src.split("?")[0].match(/\.(png|jpe?g|webp|gif|svg|avif)$/i)?.[0] ?? ".bin";
        const file = `${sha(src)}${ext}`;
        const dest = path.join(OUT, "assets", file);
        if (!existsSync(dest)) {
          const res = await fetch(src);
          if (res.ok) writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
        }
        localImgs.push({ src, local: `assets/${file}` });
      } catch { localImgs.push({ src, local: null }); }
    }
    await page.screenshot({ path: path.join(OUT, "screenshots", `${slug}.png`), fullPage: true });
    const header = `<!-- captured ${new Date().toISOString().slice(0, 10)} from ${ORIGIN}${route} — title: ${title} -->\n\n`;
    writeFileSync(path.join(OUT, `${slug}.md`), header + md + "\n");
    inventory.push({ route, slug, title, chars: md.length, images: localImgs.length });
    console.log(`✓ ${route.padEnd(28)} ${String(md.length).padStart(6)} chars, ${imgs.length} imgs`);
  } catch (e) {
    inventory.push({ route, slug, error: String(e.message ?? e) });
    console.log(`✗ ${route} — ${e.message}`);
  }
}
// merge with any prior inventory (explicit-route runs add to the discovery run)
const invPath = path.join(OUT, "inventory.json");
let prior = [];
try { prior = JSON.parse((await import("node:fs")).readFileSync(invPath, "utf8")); } catch { /* first run */ }
const merged = [...prior.filter((p) => !inventory.some((n) => n.route === p.route)), ...inventory]
  .sort((a, b) => a.route.localeCompare(b.route));
writeFileSync(invPath, JSON.stringify(merged, null, 2));
await browser.close();
console.log(`\ncontent inventory → ${OUT} (${inventory.length} routes)`);
