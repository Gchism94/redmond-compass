// UI smoke suite — both shells, both languages. Mirrored assertion sets at
// 390px (AppShell: bottom-tab PWA) and 1280px (WebShell: the desktop site that
// must read as the original redmondcompass.com). Self-contained: builds are NOT
// run here — it serves the existing dist/ via `vite preview`, so run
// `npm run build` first.  Usage:  node scripts/ui-smoke.mjs
import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4321;
const BASE = `http://localhost:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");

if (!existsSync(path.join(ROOT, "dist/index.html"))) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: ROOT,
  stdio: "ignore",
});
process.on("exit", () => server.kill());
for (let i = 0; ; i++) {
  try {
    await fetch(BASE);
    break;
  } catch {
    if (i > 40) throw new Error("vite preview did not start");
    await new Promise((r) => setTimeout(r, 250));
  }
}

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

// ---------------- 390px — AppShell (mobile PWA) ----------------
{
  const { page, errors, visit } = await newPage(390, 844);
  const label = (m) => `[390] ${m}`;

  let r = await visit("/");
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /skip for now|omitir por ahora/i.test(b.textContent))?.click();
  });
  r = await visit("/");
  ok(await page.$("nav a[href='/saved']") !== null || /home|inicio/i.test(r.text), label("bottom tab nav present"));
  ok(!(await page.$("footer")), label("no desktop footer"));
  ok(r.overflowX === 0, label(`home: no horizontal overflow (${r.overflowX})`));

  r = await visit("/search/results");
  ok(r.overflowX === 0, label(`results: no horizontal overflow (${r.overflowX})`));

  r = await visit("/getting-settled");
  ok(r.title === "Getting Settled | Redmond Compass", label("guide title set"));
  ok(r.overflowX === 0, label(`guide: no horizontal overflow (${r.overflowX})`));

  await page.evaluate(() => localStorage.setItem("rc.lang", "es"));
  r = await visit("/getting-settled");
  ok(r.lang === "es" && r.text.includes("Primeros pasos"), label("Spanish renders"));
  r = await visit("/");
  ok(/inicio/i.test(r.text) && /buscar/i.test(r.text), label("Spanish tab labels"));
  await page.evaluate(() => localStorage.setItem("rc.lang", "en"));

  ok(errors.length === 0, label(`zero console errors (${errors.length ? errors.join(" | ").slice(0, 160) : "clean"}）`));
  await page.close();
}

// ---------------- 1280px — WebShell (desktop site) ----------------
{
  const { page, errors, visit } = await newPage(1280, 900);
  const label = (m) => `[1280] ${m}`;

  let r = await visit("/");
  // header: logo bar + primary links + guide links row + Sign in / Get the app
  ok((await page.$("header nav[aria-label='Primary']")) !== null, label("top nav present"));
  ok(/help & essentials/i.test(r.text) && /seasonal safety/i.test(r.text) && /new to redmond/i.test(r.text), label("guide link row present"));
  ok(/sign in/i.test(r.text) && /get the app/i.test(r.text), label("Sign in / Get the app present"));
  // hero per the original site
  ok(r.text.includes("Your Guide to Redmond Living"), label("home hero headline"));
  ok((await page.$("img[src='/web/hero.jpg']")) !== null, label("hero mural (self-hosted)"));
  // footer columns per the original site
  ok((await page.$("footer")) !== null && /explore/i.test(r.text) && /contribute/i.test(r.text) && /made with/i.test(r.text), label("footer columns present"));
  // no mobile chrome
  ok(!/skip for now/i.test(r.text), label("no mobile onboarding overlay"));
  ok((await page.$("nav a[href='/saved']")) === null, label("no bottom tab nav"));
  ok(r.overflowX === 0, label(`home: no horizontal overflow (${r.overflowX})`));
  // equal ranking: the original's "Featured" framing must NOT come back
  ok(!/featured/i.test(r.text), label("no Featured section (equal ranking)"));

  // directory grid: 3–4 columns
  r = await visit("/search/results");
  const cols = await page.evaluate(() => {
    const ul = [...document.querySelectorAll("ul")].find((u) => getComputedStyle(u).display === "grid");
    return ul ? getComputedStyle(ul).gridTemplateColumns.split(" ").length : 0;
  });
  ok(cols >= 3 && cols <= 4, label(`results grid ${cols} columns`));
  ok(r.overflowX === 0, label(`results: no horizontal overflow (${r.overflowX})`));

  // guides at readable max-width
  r = await visit("/getting-settled");
  const guideWidth = await page.evaluate(() => {
    const h = document.querySelector("main h2");
    let el = h;
    while (el && el.clientWidth === 0) el = el.parentElement;
    return el ? el.clientWidth : 0;
  });
  ok(guideWidth > 0 && guideWidth <= 700, label(`guide readable width (${guideWidth}px)`));
  ok(r.title === "Getting Settled | Redmond Compass", label("guide title set"));
  ok(r.overflowX === 0, label(`guide: no horizontal overflow (${r.overflowX})`));

  // Spanish sweep (footer toggle exists; set storage directly for determinism)
  await page.evaluate(() => localStorage.setItem("rc.lang", "es"));
  r = await visit("/");
  ok(r.lang === "es" && r.text.includes("Tu guía para vivir en Redmond"), label("Spanish hero"));
  ok(/ayuda esencial/i.test(r.text) && /directorio/i.test(r.text), label("Spanish nav + guide links"));
  ok(/hecho con/i.test(r.text), label("Spanish footer"));
  r = await visit("/getting-settled");
  ok(r.text.includes("Primeros pasos"), label("Spanish guide"));
  ok(r.overflowX === 0, label(`ES: no horizontal overflow (${r.overflowX})`));
  await page.evaluate(() => localStorage.setItem("rc.lang", "en"));

  ok(errors.length === 0, label(`zero console errors (${errors.length ? errors.join(" | ").slice(0, 160) : "clean"})`));
  await page.close();
}

await browser.close();
server.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
