// UI smoke suite — both shells, both languages, mode-aware (compass.config.ts).
// Mirrored assertion sets at 390px (AppShell: bottom-tab PWA) and 1280px (WebShell).
// In app-only mode `/` is the marketing landing page and the app home lives at
// /home; the suite asserts the landing, the app, AND the §3 SEO guards
// (1-URL sitemap, robots disallows, noindex + cross-canonical on archived guides).
//
// Local (default): serves the existing dist/ via `vite preview` — run
//   `npm run build && npm run prerender` first, then  node scripts/ui-smoke.mjs
// Live/deployed (pages-dev-qa-checklist §6): point it at the real origin —
//   SMOKE_URL=https://redmond-compass.pages.dev node scripts/ui-smoke.mjs
import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { build } from "esbuild";
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REMOTE = process.env.SMOKE_URL?.replace(/\/+$/, "");
const PORT = 4321;
const BASE = REMOTE ?? `http://localhost:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");

// mode from compass.config.ts (esbuild-bundled so plain node can read the TS)
const tmp = mkdtempSync(path.join(tmpdir(), "rc-smoke-"));
await build({
  entryPoints: [path.join(ROOT, "compass.config.ts")],
  bundle: true, format: "esm", platform: "node",
  outfile: path.join(tmp, "config.mjs"), logLevel: "error",
});
const { compassConfig } = await import(path.join(tmp, "config.mjs"));
const APP_ONLY = compassConfig.siteMode === "app-only";
const LIVE = compassConfig.liveSite;
const HOME = APP_ONLY ? "/home" : "/";

let server = null;
if (!REMOTE) {
  if (!existsSync(path.join(ROOT, "dist/index.html"))) {
    console.error("dist/ not found — run `npm run build` first (or set SMOKE_URL for a deployed origin).");
    process.exit(1);
  }
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  process.on("exit", () => server?.kill());
  for (let i = 0; ; i++) {
    try {
      await fetch(BASE);
      break;
    } catch {
      if (i > 40) throw new Error("vite preview did not start");
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}
console.log(`Target: ${BASE}${REMOTE ? "  (live)" : "  (local preview)"}   mode: ${compassConfig.siteMode}\n`);

let pass = 0,
  fail = 0;
const ok = (c, m) => {
  console.log(`${c ? "PASS" : "FAIL"}  ${m}`);
  c ? pass++ : fail++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

async function newPage(width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: width < 800, hasTouch: width < 800 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const visit = async (route) => {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 400));
    return page.evaluate(() => ({
      text: document.body.innerText,
      title: document.title,
      lang: document.documentElement.lang,
      path: location.pathname,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
  };
  return { page, errors, visit };
}

// ---------------- 390px — AppShell (mobile PWA) + landing ----------------
{
  const { page, errors, visit } = await newPage(390, 844);
  const label = (m) => `[390] ${m}`;

  if (APP_ONLY) {
    const L = await visit("/");
    ok(/now on your phone/i.test(L.text), label("landing hero present"));
    ok(L.text.includes("Terrebonne") && L.text.includes("Crooked River Ranch"), label("landing names all three towns"));
    ok(!/skip for now|omitir por ahora/i.test(L.text), label("no onboarding overlay on landing"));
    ok((await page.$("nav a[href='/saved']")) === null, label("no app tab bar on landing"));
    ok(/own sign-in/i.test(L.text), label("account-separation note present"));
    ok(L.overflowX === 0, label(`landing: no horizontal overflow (${L.overflowX})`));
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => /open the app/i.test(b.textContent))?.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    ok((await page.evaluate(() => location.pathname)) === "/home", label("'Open the app' → /home"));
  }

  let r = await visit(HOME);
  // onboarding is a mobile-only first-launch ritual — must be PRESENT here (fresh
  // context), and the 1280 set asserts its absence.
  ok(/skip for now|omitir por ahora/i.test(r.text), label("onboarding overlay present on first launch"));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /skip for now|omitir por ahora/i.test(b.textContent))?.click();
  });
  r = await visit(HOME);
  ok((await page.$("nav a[href='/saved']")) !== null || /home|inicio/i.test(r.text), label("bottom tab nav present"));
  const tapH = await page.evaluate(() => {
    const el = document.querySelector("nav a[href='/search']") ?? document.querySelector("nav a");
    return el ? Math.round(el.getBoundingClientRect().height) : 0;
  });
  ok(tapH >= 44, label(`tab tap target ≥44px (${tapH}px)`));
  ok(!(await page.$("footer")), label("no desktop footer in the app"));
  ok(r.overflowX === 0, label(`app home: no horizontal overflow (${r.overflowX})`));

  r = await visit("/search/results");
  ok(r.overflowX === 0, label(`results: no horizontal overflow (${r.overflowX})`));

  r = await visit("/getting-settled");
  ok(r.title === "Getting Settled | Redmond Compass", label("guide title set"));
  // CONTENT, not just title: the prerendered <head> keeps the title correct even
  // when the SPA is stuck on its skeleton — only a body-text assertion catches that.
  ok(r.text.includes("first-week checklist") && r.text.includes("Cascades East Transit"), label("guide content renders (not skeleton)"));
  ok(r.overflowX === 0, label(`guide: no horizontal overflow (${r.overflowX})`));

  await page.evaluate(() => localStorage.setItem("rc.lang", "es"));
  if (APP_ONLY) {
    const Les = await visit("/");
    ok(/ahora en tu teléfono/i.test(Les.text), label("landing Spanish renders"));
  }
  r = await visit("/getting-settled");
  ok(r.lang === "es" && r.text.includes("Primeros pasos"), label("Spanish guide renders"));
  r = await visit(HOME);
  ok(/inicio/i.test(r.text) && /buscar/i.test(r.text), label("Spanish tab labels"));
  await page.evaluate(() => localStorage.setItem("rc.lang", "en"));

  ok(errors.length === 0, label(`zero console errors (${errors.length ? errors.join(" | ").slice(0, 160) : "clean"})`));
  await page.close();
}

// ---------------- 1280px — WebShell (desktop) + landing + SEO guards ----------------
{
  const { page, errors, visit } = await newPage(1280, 900);
  const label = (m) => `[1280] ${m}`;

  if (APP_ONLY) {
    const L = await visit("/");
    ok(/now on your phone/i.test(L.text) && L.text.includes("Terrebonne"), label("landing renders"));
    ok(!L.text.includes("Your Guide to Redmond Living"), label("site home NOT presented at /"));
    ok(!/featured/i.test(L.text), label("no Featured on landing (equal ranking)"));
    ok(L.overflowX === 0, label(`landing: no horizontal overflow (${L.overflowX})`));
  }

  let r = await visit(HOME);
  ok((await page.$("header nav[aria-label='Primary']")) !== null, label("top nav present"));
  ok(/help & essentials/i.test(r.text) && /seasonal safety/i.test(r.text) && /new to redmond/i.test(r.text), label("guide link row present"));
  if (APP_ONLY) {
    const outbound = await page.$$eval("header nav[aria-label='Guides'] a", (as) =>
      as.length > 0 && as.every((a) => a.href.startsWith("https://redmondcompass.com")),
    );
    ok(outbound, label("guide row links OUT to the live site"));
  }
  ok(/sign in/i.test(r.text) && /get the app/i.test(r.text), label("Sign in / Get the app present"));
  ok(r.text.includes("Your Guide to Redmond Living"), label("app desktop home hero"));
  ok((await page.$("img[src='/web/hero.jpg']")) !== null, label("hero mural (self-hosted)"));
  ok((await page.$("footer")) !== null && /explore/i.test(r.text) && /contribute/i.test(r.text) && /made with/i.test(r.text), label("footer columns present"));
  ok(!/skip for now/i.test(r.text), label("no mobile onboarding overlay"));
  ok((await page.$("nav a[href='/saved']")) === null, label("no bottom tab nav"));
  ok(r.overflowX === 0, label(`app home: no horizontal overflow (${r.overflowX})`));
  ok(!/featured/i.test(r.text), label("no Featured section (equal ranking)"));

  // directory grid: 3–4 columns
  r = await visit("/search/results");
  const cols = await page.evaluate(() => {
    const ul = [...document.querySelectorAll("ul")].find((u) => getComputedStyle(u).display === "grid");
    return ul ? getComputedStyle(ul).gridTemplateColumns.split(" ").length : 0;
  });
  ok(cols >= 3 && cols <= 4, label(`results grid ${cols} columns`));
  ok(r.overflowX === 0, label(`results: no horizontal overflow (${r.overflowX})`));

  // guides at readable max-width, with real content
  r = await visit("/getting-settled");
  const guideWidth = await page.evaluate(() => {
    const h = document.querySelector("main h2");
    let el = h;
    while (el && el.clientWidth === 0) el = el.parentElement;
    return el ? el.clientWidth : 0;
  });
  ok(guideWidth > 0 && guideWidth <= 700, label(`guide readable width (${guideWidth}px)`));
  ok(r.title === "Getting Settled | Redmond Compass", label("guide title set"));
  ok(r.text.includes("first-week checklist"), label("guide content renders (not skeleton)"));
  ok(r.overflowX === 0, label(`guide: no horizontal overflow (${r.overflowX})`));

  // Spanish sweep
  await page.evaluate(() => localStorage.setItem("rc.lang", "es"));
  r = await visit(HOME);
  ok(r.lang === "es" && r.text.includes("Tu guía para vivir en Redmond"), label("Spanish app home hero"));
  ok(/ayuda esencial/i.test(r.text) && /directorio/i.test(r.text), label("Spanish nav + guide links"));
  ok(/hecho con/i.test(r.text), label("Spanish footer"));
  r = await visit("/getting-settled");
  ok(r.text.includes("Primeros pasos"), label("Spanish guide"));
  ok(r.overflowX === 0, label(`ES: no horizontal overflow (${r.overflowX})`));
  await page.evaluate(() => localStorage.setItem("rc.lang", "en"));

  ok(errors.length === 0, label(`zero console errors (${errors.length ? errors.join(" | ").slice(0, 160) : "clean"})`));
  await page.close();
}

// ---------------- SEO guards (App-Only spec §3) — raw fetches, no browser ----------------
{
  const label = (m) => `[seo] ${m}`;
  const text = async (p) => (await fetch(`${BASE}${p}`)).text();
  const sitemap = await text("/sitemap.xml");
  const urlCount = (sitemap.match(/<url>/g) ?? []).length;
  if (APP_ONLY) {
    ok(urlCount === 1, label(`sitemap has exactly 1 URL (${urlCount})`));
    const robots = await text("/robots.txt");
    ok(robots.includes("Disallow: /getting-settled") && robots.includes("Disallow: /ember"), label("robots disallows archived guides"));
    ok(!robots.includes("Disallow: /privacy"), label("robots does NOT disallow /privacy (noindex must be crawlable)"));
    const guide = await text("/getting-settled");
    ok(/name="robots" content="noindex,follow"/.test(guide), label("archived guide carries noindex"));
    ok(guide.includes(`rel="canonical" href="${LIVE}/getting-settled"`), label("archived guide canonical → live site"));
    const priv = await text("/privacy");
    ok(/name="robots" content="noindex,follow"/.test(priv) && !priv.includes(`href="${LIVE}/privacy"`), label("privacy noindexed, canonical stays ours"));
    const shell = await text("/");
    ok(shell.includes('rel="canonical" href="https://app.redmondcompass.com/"'), label("shell canonical → app origin"));
    ok(shell.includes("/og.jpg") && !/media\.base44/.test(shell), label("self-hosted OG image (no Base44 CDN)"));
  } else {
    ok(urlCount === 18, label(`full-site sitemap has 18 URLs (${urlCount})`));
    const guide = await text("/getting-settled");
    ok(!/noindex/.test(guide), label("guides indexable in full-site mode"));
  }
}

await browser.close();
server?.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
