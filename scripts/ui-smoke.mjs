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
    ok(/local directory/i.test(L.text), label("landing hero present"));
    ok(L.text.includes("Terrebonne") && L.text.includes("Crooked River Ranch"), label("landing names all three towns"));
    ok(!/skip for now|omitir por ahora/i.test(L.text), label("no onboarding overlay on landing"));
    ok((await page.$("nav a[href='/saved']")) === null, label("no app tab bar on landing"));
    ok(/sign-in is separate/i.test(L.text), label("account-separation note present"));
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

  // Tap-target guarantee (#9): every pressable control on the app surfaces must be ≥44px
  // tall, not just the one nav link. Sweeps buttons + role=button/tab, lists any offenders.
  const tapOffenders = () =>
    page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('a[href], button, [role="button"], [role="tab"], input, select, summary')) {
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (rect.width === 0 || rect.height === 0 || cs.visibility === "hidden") continue; // hidden
        if (cs.clip !== "auto" || cs.clipPath !== "none") continue; // visually-hidden skip links
        if (rect.height < 43.5)
          out.push(`${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 16)}" ${Math.round(rect.height)}px`);
      }
      return out;
    });
  let taps = await tapOffenders();
  ok(taps.length === 0, label(`home: every tap target ≥44px tall (${taps.length ? taps.join(" · ") : "ok"})`));

  r = await visit("/search");
  ok((await page.$("[data-search-layout] h1")) !== null, label("search: visible page heading present"));
  taps = await tapOffenders();
  ok(taps.length === 0, label(`search: every tap target ≥44px tall (${taps.length ? taps.join(" · ") : "ok"})`));

  r = await visit("/search/results?q=Burger%20Wild");
  ok(r.overflowX === 0, label(`results: no horizontal overflow (${r.overflowX})`));
  const mapControls = await page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((el) => /^map$|^mapa$/i.test((el.textContent || "").trim())).length,
  );
  ok(mapControls === 0 && !/map view is coming soon|el mapa llega pronto/i.test(r.text),
     label("results: unfinished Map view is not advertised"));
  const impreciseDistance = await page.evaluate(() => {
    const card = [...document.querySelectorAll("[data-result-card], article")]
      .find((el) => /Burger Wild - All American/i.test(el.textContent || ""));
    return card ? /\bnearby\b/i.test(card.textContent || "") : null;
  });
  ok(impreciseDistance === false, label("results: synthetic center coordinate is not shown as a distance"));
  taps = await tapOffenders();
  ok(taps.length === 0, label(`results: every tap target ≥44px tall (${taps.length ? taps.join(" · ") : "ok"})`));

  r = await visit("/b/burger-wild-all-american");
  ok(/11:00 AM\s*[–-]\s*10:00 PM/i.test(r.text) && /Mon(?:\s*·\s*Today)?\s+Closed/i.test(r.text) && !/hours not listed/i.test(r.text),
     label("profile: parsed weekly hours include source times and closed days"));
  const unavailableProfileActions = await page.evaluate(() => ({
    call: document.querySelectorAll('a[href^="tel:"]').length,
    blankAddress: /Address:\s*(?:About|$)/i.test(document.body.innerText),
  }));
  ok(unavailableProfileActions.call === 0 && !unavailableProfileActions.blankAddress,
     label("profile: unavailable phone/address actions are omitted"));
  taps = await tapOffenders();
  ok(taps.length === 0, label(`profile: every tap target ≥44px tall (${taps.length ? taps.join(" · ") : "ok"})`));

  r = await visit("/events");
  taps = await tapOffenders();
  ok(taps.length === 0, label(`events: every tap target ≥44px tall (${taps.length ? taps.join(" · ") : "ok"})`));

  r = await visit("/resources");
  taps = await tapOffenders();
  ok(taps.length === 0, label(`resources: every tap target ≥44px tall (${taps.length ? taps.join(" · ") : "ok"})`));

  r = await visit("/community");
  ok(/past notices|anuncios anteriores/i.test(r.text) && !/conditions are critically dry/i.test(r.text),
     label("community: expired safety notice is collapsed into dated archive"));

  r = await visit("/claim");
  taps = await tapOffenders();
  ok(taps.length === 0, label(`claim: every tap target ≥44px tall (${taps.length ? taps.join(" · ") : "ok"})`));

  // ---- /account (added 2026-08-14) ----
  // This route was NEVER visited by this suite, so a 57/57 pass said nothing about the
  // Account screen. That blind spot is why an EN-only copy change shipped through a green
  // run: the Spanish string for a removed feature ("tus intereses") survived a
  // source-language grep AND the smoke suite, because neither looked here.
  r = await visit("/account");
  ok(/browsing as a guest/i.test(r.text), label("account renders for a guest (not a skeleton)"));
  ok(/settings/i.test(r.text) && /location/i.test(r.text) && /language/i.test(r.text),
     label("account: settings rows present"));
  ok(/privacy & terms/i.test(r.text), label("account: privacy link present"));
  ok(r.overflowX === 0, label(`account: no horizontal overflow (${r.overflowX})`));
  taps = await tapOffenders();
  ok(taps.length === 0, label(`account: every tap target ≥44px tall (${taps.length ? taps.join(" · ") : "ok"})`));

  // Two things must STAY GONE. Both were live settings that quietly promised behaviour the
  // app does not have: interests were read by nothing, and the notification toggles had no
  // delivery mechanism. Asserting their absence keeps a well-meaning re-add from silently
  // restoring the promise.
  const switches = await page.evaluate(
    () => document.querySelectorAll('[role="switch"], input[type="checkbox"]').length,
  );
  ok(switches === 0, label(`account: no notification toggles — nothing delivers them yet (${switches})`));
  ok(!/notification|bulletins from places|saved-event reminders/i.test(r.text),
     label("account: no notification copy"));
  ok(!/your interests|add interests/i.test(r.text), label("account: interests question stays removed"));

  r = await visit("/getting-settled");
  ok(r.title === "Getting Settled | Redmond Compass", label("guide title set"));
  // CONTENT, not just title: the prerendered <head> keeps the title correct even
  // when the SPA is stuck on its skeleton — only a body-text assertion catches that.
  ok(r.text.includes("first-week checklist") && r.text.includes("Cascades East Transit"), label("guide content renders (not skeleton)"));
  ok(r.overflowX === 0, label(`guide: no horizontal overflow (${r.overflowX})`));

  await page.evaluate(() => localStorage.setItem("rc.lang", "es"));
  if (APP_ONLY) {
    const Les = await visit("/");
    ok(/directorio local de Redmond/i.test(Les.text), label("landing Spanish renders"));
  }
  r = await visit("/getting-settled");
  ok(r.lang === "es" && r.text.includes("Primeros pasos"), label("Spanish guide renders"));
  r = await visit(HOME);
  ok(/inicio/i.test(r.text) && /buscar/i.test(r.text), label("Spanish tab labels"));
  // The ES half is the one that matters here: an English-only grep is structurally blind to
  // a stale Spanish string, which is exactly how "tus intereses" survived item 3.
  r = await visit("/account");
  ok(/navegando como invitado/i.test(r.text), label("Spanish account renders"));
  ok(/configuración/i.test(r.text) && /ubicación/i.test(r.text) && /idioma/i.test(r.text),
     label("Spanish account: settings rows translated"));
  ok(!/notificaciones|recordatorios de eventos|avisos de los lugares/i.test(r.text),
     label("Spanish account: no notification copy"));
  ok(!/tus intereses|agrega intereses/i.test(r.text),
     label("Spanish account: no leftover interests copy"));
  ok(r.overflowX === 0, label(`ES account: no horizontal overflow (${r.overflowX})`));
  await page.evaluate(() => localStorage.setItem("rc.lang", "en"));

  ok(errors.length === 0, label(`zero console errors (${errors.length ? errors.join(" | ").slice(0, 160) : "clean"})`));
  await page.close();
}

// ---------------- 1024px — compact desktop landing breakpoint ----------------
if (APP_ONLY) {
  const { page, errors, visit } = await newPage(1024, 700);
  const label = (m) => `[1024] ${m}`;
  const L = await visit("/");
  const composition = await page.$eval("[data-landing-hero]", (hero) => {
    const visual = hero.querySelector("[data-landing-visual]");
    const preview = hero.querySelector("[data-landing-preview]");
    const mural = hero.querySelector("[data-landing-mural]");
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return { top: value.top, right: value.right, bottom: value.bottom, left: value.left, height: value.height };
    };
    return {
      hero: rect(hero),
      visual: rect(visual),
      preview: rect(preview),
      muralFit: getComputedStyle(mural).objectFit,
    };
  });
  ok(L.overflowX === 0, label(`landing: no horizontal overflow (${L.overflowX})`));
  ok(composition.preview.top >= composition.visual.top && composition.preview.bottom <= composition.visual.bottom,
     label("landing: app preview is fully contained in the mural panel"));
  ok(composition.muralFit === "contain", label("landing: mural is shown whole rather than cropped"));
  ok(composition.hero.height <= 460, label(`landing: compact hero height (${Math.round(composition.hero.height)}px)`));
  ok(errors.length === 0, label(`zero console errors (${errors.length ? errors.join(" | ").slice(0, 160) : "clean"})`));
  await page.close();
}

// ---------------- 1280px — WebShell (desktop) + landing + SEO guards ----------------
{
  const { page, errors, visit } = await newPage(1280, 900);
  const label = (m) => `[1280] ${m}`;

  if (APP_ONLY) {
    const L = await visit("/");
    ok(/local directory/i.test(L.text) && L.text.includes("Terrebonne"), label("landing renders"));
    ok(!L.text.includes("Your Guide to Redmond Living"), label("site home NOT presented at /"));
    ok(!/featured/i.test(L.text), label("no Featured on landing (equal ranking)"));
    ok(L.overflowX === 0, label(`landing: no horizontal overflow (${L.overflowX})`));
    const installCards = await page.$$eval("#install button[aria-expanded]", (buttons) =>
      buttons.map((button) => ({
        expanded: button.getAttribute("aria-expanded") === "true",
        height: Math.round(button.parentElement?.getBoundingClientRect().height ?? 0),
      })),
    );
    const expandedHeight = installCards.find((card) => card.expanded)?.height ?? 0;
    const collapsedHeights = installCards.filter((card) => !card.expanded).map((card) => card.height);
    ok(expandedHeight > 0 && collapsedHeights.length > 0 && collapsedHeights.every((height) => height < expandedHeight),
       label("landing: collapsed install cards do not retain empty expanded height"));
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
  const desktopMural = await page.$eval("img[data-desktop-hero-mural]", (img) => ({
    fit: getComputedStyle(img).objectFit,
    width: Math.round(img.getBoundingClientRect().width),
    naturalRatio: img.naturalWidth / img.naturalHeight,
  }));
  ok(desktopMural.fit === "contain" && desktopMural.width > 0 && desktopMural.naturalRatio === 2,
     label("hero mural is self-hosted and shown whole rather than cropped"));
  ok((await page.$("footer")) !== null && /explore/i.test(r.text) && /contribute/i.test(r.text) && /made with/i.test(r.text), label("footer columns present"));
  ok(!/skip for now/i.test(r.text), label("no mobile onboarding overlay"));
  ok((await page.$("nav a[href='/saved']")) === null, label("no bottom tab nav"));
  ok(r.overflowX === 0, label(`app home: no horizontal overflow (${r.overflowX})`));
  ok(!/featured/i.test(r.text), label("no Featured section (equal ranking)"));
  const desktopHomeWidth = await page.$eval("main", (el) => Math.round(el.getBoundingClientRect().width));
  ok(desktopHomeWidth >= 1000, label(`app home uses the wide desktop canvas (${desktopHomeWidth}px)`));

  r = await visit("/search");
  const searchLayout = await page.$eval("[data-search-layout]", (el) => ({
    width: Math.round(el.getBoundingClientRect().width),
    hasHeading: !!el.querySelector("h1"),
  }));
  ok(searchLayout.hasHeading && searchLayout.width <= 930,
     label(`search has heading + deliberate desktop measure (${searchLayout.width}px)`));

  // Directory grid: image-led desktop cards, never mobile rows squeezed into tiles.
  r = await visit("/search/results");
  ok(!/map view is coming soon/i.test(r.text), label("results does not advertise unfinished Map view"));
  const cols = await page.evaluate(() => {
    const ul = [...document.querySelectorAll("ul")].find((u) => getComputedStyle(u).display === "grid");
    return ul ? getComputedStyle(ul).gridTemplateColumns.split(" ").length : 0;
  });
  ok(cols >= 2 && cols <= 3, label(`results grid ${cols} readable columns`));
  const initialCardCount = await page.$$eval('[data-result-card="desktop"]', (cards) => cards.length);
  ok(initialCardCount > 0 && initialCardCount <= 30 && /show more places/i.test(r.text),
     label(`results progressively reveal the full directory (${initialCardCount} cards initially)`));
  const cardVisual = await page.evaluate(() => {
    const card = document.querySelector('[data-result-card="desktop"]');
    const frame = card?.querySelector(".brand-image-frame");
    const img = frame?.querySelector("img");
    const fallback = frame?.querySelector('[data-business-image-fallback], [data-thumb-fallback="brand"]');
    const actions = [...(card?.querySelectorAll("[data-card-actions] a") ?? [])];
    const rects = actions.map((el) => el.getBoundingClientRect());
    return {
      card: card ? Math.round(card.getBoundingClientRect().width) : 0,
      imageWidth: frame ? Math.round(frame.getBoundingClientRect().width) : 0,
      imageHeight: frame ? Math.round(frame.getBoundingClientRect().height) : 0,
      imageFit: img ? getComputedStyle(img).objectFit : "",
      brandedFallback: !!fallback,
      actionsSeparate: rects.length >= 2 && rects[0].right <= rects[1].left,
    };
  });
  ok(cardVisual.card >= 330, label(`directory card has usable width (${cardVisual.card}px)`));
  ok(cardVisual.imageWidth >= 300 && cardVisual.imageHeight >= 150,
     label(`directory image is visually useful (${cardVisual.imageWidth}×${cardVisual.imageHeight}px)`));
  ok(cardVisual.imageFit === "contain" || cardVisual.brandedFallback,
     label("directory identity artwork is not cropped, with branded fallback when missing"));
  ok(cardVisual.actionsSeparate, label("directory Call / Directions actions do not overlap"));
  const unearnedDistanceClaims = await page.$$eval('[data-result-card="desktop"]', (cards) =>
    cards.filter((card) => /(?:\bnearby\b|\b\d+(?:\.\d+)? mi\b)/i.test(card.textContent || "")).length,
  );
  ok(unearnedDistanceClaims === 0,
     label("directory shows no distance before the user shares a location"));
  ok(r.overflowX === 0, label(`results: no horizontal overflow (${r.overflowX})`));

  r = await visit("/login");
  const duplicateLoginLink = await page.$("header a[href='/login']");
  ok(duplicateLoginLink === null, label("login: desktop header does not repeat the current Sign in action"));
  const guideTapHeight = await page.$eval("header nav[aria-label='Guides'] a", (el) =>
    Math.round(el.getBoundingClientRect().height),
  );
  ok(guideTapHeight >= 44, label(`desktop guide links have 44px targets (${guideTapHeight}px)`));

  // Long-form/list screens use a readable measure instead of the wide grid canvas.
  r = await visit("/events");
  const eventsWidth = await page.$eval("main", (el) => Math.round(el.getBoundingClientRect().width));
  ok(eventsWidth <= 800, label(`events uses readable desktop measure (${eventsWidth}px)`));
  r = await visit("/community");
  const communityWidth = await page.$eval("main", (el) => Math.round(el.getBoundingClientRect().width));
  ok(communityWidth <= 800, label(`community uses readable desktop measure (${communityWidth}px)`));

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
