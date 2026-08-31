// Town notices on Community (item 6, 2026-08-15).
//
// WHY THIS SCREEN IS DELICATE. The only row in `community_bulletins` today is a Fourth of
// July fire-danger warning with `pinned = true`, long past its useful prominence window.
// Pinned data alone must not keep it at the top forever. Old notices remain readable and
// absolutely dated, but start inside a collapsed Past notices disclosure. When a source
// supplies an explicit active-until date, that editorial signal takes precedence.
//
//   node scripts/community-notices-test.mjs
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4482;
const BASE = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

const tmp = mkdtempSync(path.join(tmpdir(), "rc-cn-"));
const entry = path.join(tmp, "entry.tsx");
writeFileSync(entry, `
import { createRoot } from "react-dom/client";
import { createElement as h } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { DataProvider } from "@/data/DataProvider";
import { SessionProvider } from "@/features/account/session";
import { MockDataSource } from "@/data/mock/MockDataSource";
import { CommunityScreen } from "@/features/community/CommunityScreen";

const q = new URLSearchParams(location.search);
localStorage.setItem("rc.lang", q.get("lang") ?? "en");

// Modelled on the REAL row: pinned, stale, with a base44 image and a support link — the
// exact shape that must not be able to present itself as current or drag in a dying CDN.
const STALE = {
  id: "cn_stale",
  title: "EXTREME FIRE DANGER in Redmond This Fourth of July",
  body: "Conditions are critically dry. Skip personal fireworks.",
  imageUrl: "https://media.base44.com/images/public/abc/fire.jpg",
  supportLink: "https://www.gofundme.com/f/example",
  supportLabel: "Donate",
  pinned: true,
  category: "announcement",
  createdAt: "2000-07-03T05:41:30.455Z",
};
const EXPLICIT_ACTIVE = {
  id: "cn_explicit",
  title: "Long-running water conservation notice",
  body: "This notice has an explicit active-until date.",
  pinned: true,
  category: "announcement",
  createdAt: "2001-06-01T17:00:00.000Z",
  activeUntil: "2099-12-31T23:59:59.000Z",
};
const RECENT = {
  id: "cn_recent",
  title: "Library reopens Saturday",
  body: "The remodel is finished.",
  pinned: false,
  category: "announcement",
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
};
const STALE_NEWS = q.get("staleNews") === "1";

const EMPTY = q.get("empty") === "1";
const FAIL = q.get("fail") === "1";

function source() {
  const base = new MockDataSource();
  return new Proxy(base, {
    get(t, prop, r) {
      if (prop === "listNews") return async () => STALE_NEWS ? [{
        id: "news_old", slug: "older-story", title: "An older local story", excerpt: "",
        body: "Archived reporting remains available.", source: "Test source",
        publishedAt: "2000-01-02T17:00:00.000Z",
      }] : [];
      if (prop === "listBulletins") return async () => [];
      if (prop === "listCommunityNotices") return async () =>
        FAIL ? Promise.reject(new TypeError("Failed to fetch")) : EMPTY ? [] : [STALE, EXPLICIT_ACTIVE, RECENT];
      const v = Reflect.get(t, prop, r);
      return typeof v === "function" ? v.bind(t) : v;
    },
  });
}

createRoot(document.getElementById("root")).render(
  h(I18nProvider, null,
    h(DataProvider, { source: source() },
      h(SessionProvider, null,
        h(MemoryRouter, { initialEntries: ["/community"] },
          h(Routes, null,
            h(Route, { path: "/community", element: h(CommunityScreen) })))))),
);
`);

const outdir = path.join(tmp, "site");
await build({
  entryPoints: [entry], bundle: true, format: "esm", platform: "browser",
  outfile: path.join(outdir, "app.js"), logLevel: "error", jsx: "automatic",
  absWorkingDir: ROOT, nodePaths: [path.join(ROOT, "node_modules")],
  alias: { "@": path.join(ROOT, "src"), "@config": path.join(ROOT, "compass.config.ts") },
  loader: { ".css": "empty" },
  define: {
    "import.meta.env.DEV": "false", "import.meta.env.PROD": "true",
    "import.meta.env.VITE_DATA_SOURCE": '"mock"',
    "import.meta.env.VITE_SUPABASE_URL": '""', "import.meta.env.VITE_SUPABASE_ANON_KEY": '""',
    "process.env.NODE_ENV": '"production"',
  },
});
writeFileSync(path.join(outdir, "index.html"),
  `<!doctype html><html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`);

const server = spawn("npx", ["--yes", "http-server", outdir, "-p", String(PORT), "-s"], { stdio: "ignore" });
for (let i = 0; ; i++) {
  try { await fetch(BASE); break } catch {
    await new Promise((r) => setTimeout(r, 300));
    if (i > 60) { server.kill(); throw new Error("harness did not start"); }
  }
}
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

async function load(qs = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 437, height: 1100, deviceScaleFactor: 2, isMobile: true });
  await page.goto(`${BASE}/?${new URLSearchParams(qs)}`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, qs.fail ? 1800 : 900));
  return page;
}
const bodyText = (p) => p.evaluate(() => document.body.innerText);

// ── 1. THE DATE IS NON-NEGOTIABLE ────────────────────────────────────────────────────────
{
  const page = await load();
  const txt = await bodyText(page);
  ok(/Notices/.test(txt), "the Notices section renders");
  ok(/Long-running water conservation/.test(txt), "an explicitly active notice remains prominent regardless of age");
  ok(/Library reopens/.test(txt), "a recent notice remains prominent");
  ok(!/EXTREME FIRE DANGER/.test(txt), "an old notice does not dominate the initial view");
  ok(/Past notices \(1\)/.test(txt), "the old notice remains available in a clearly labelled archive");
  await page.click("details summary");
  const expanded = await bodyText(page);
  ok(/EXTREME FIRE DANGER/.test(expanded), "expanding Past notices preserves the authored notice");
  // Jul 2, not Jul 3: 2000-07-03T05:41:30Z is 10:41 PM Pacific on July 2, and this renders
  // in REDMOND's zone because that is the day the town was told. My first expectation here
  // was Jul 3 — reading the UTC string rather than the local day — which is the same
  // confusion the classes date bug came from, pointing the other way.
  ok(/Jul 2, 2000/.test(expanded),
     `the notice carries an ABSOLUTE Redmond-local date with the year (${(expanded.match(/\w{3} \d{1,2}, \d{4}/g) ?? []).join(" · ") || "NO DATE FOUND"})`);
  ok(/Past notice/.test(expanded), "an archived item is labelled as a past notice, not still pinned");
  // A relative time ("6 weeks ago") is NOT sufficient: it makes the reader do arithmetic
  // against a year they have to assume, on content where the year is the whole point.
  ok(!/weeks? ago|months? ago/i.test(expanded.split("Notices")[1] ?? ""),
     "the notice date is absolute, not a relative age");

  // ── 2. Pinned sorts FIRST, even though it is older ─────────────────────────────────────
  const iPinned = txt.indexOf("Long-running water conservation");
  const iRecent = txt.indexOf("Library reopens");
  ok(iPinned > -1 && iRecent > iPinned,
     "pinned sorts above a NEWER unpinned notice (editorial pin, not recency)");
  ok(/Pinned/.test(txt), "the pin is disclosed to the reader rather than silently reordering");

  // ── 3. Nothing from the dying CDN, no unreviewed money ask ─────────────────────────────
  const imgs = await page.evaluate(() =>
    [...document.querySelectorAll("img")].map((i) => i.src).filter((s) => /base44/.test(s)));
  ok(imgs.length === 0, `no base44-hosted image is loaded (${imgs.length})`);
  const gofundme = await page.evaluate(() =>
    [...document.querySelectorAll("a")].filter((a) => /gofundme/i.test(a.href)).length);
  ok(gofundme === 0, `the support/donation link is not rendered in v1 (${gofundme})`);

  // ── 4. The archive is collapsed by default, preventing old pinned content dominance ──
  ok((await page.$eval("details", (d) => d.open)) === true, "the Past notices disclosure can be opened");
  await page.close();
}

// ── 4b. THE DATE IS THE SAME FROM ANYWHERE ───────────────────────────────────────────────
// The whole point of pinning the zone. Rendered in the VIEWER's zone, this notice is July 2
// in Redmond and July 3 in New York — same notice, two dates, neither obviously wrong, and
// no error anywhere. Someone checking a fire warning from out of state should see the day
// the town was told.
{
  for (const [tz, label] of [["America/New_York", "New York"], ["Asia/Tokyo", "Tokyo"], ["UTC", "UTC"]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 437, height: 1100, isMobile: true });
    await page.emulateTimezone(tz);
    await page.goto(BASE, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 800));
    await page.click("details summary");
    const txt = await bodyText(page);
    ok(/Jul 2, 2000/.test(txt),
       `the Redmond date holds when viewed from ${label} (${(txt.match(/\w{3} \d{1,2}, \d{4}/g) ?? []).join(" · ") || "NONE"})`);
    await page.close();
  }
}

// ── 4c. OLD NEWS STAYS AVAILABLE, WITH A FACTUAL LAST-UPDATED DISCLOSURE ────────────────
{
  const page = await load({ staleNews: "1" });
  const txt = await bodyText(page);
  ok(/An older local story/.test(txt), "older news remains in the feed");
  ok(/News feed last updated Jan 2, 2000/i.test(txt), "an old news feed names its actual last update date");
  ok(/Check the original source/i.test(txt), "the age notice directs readers to the source without inventing an update");
  await page.close();
}

// ── 5. The existing feed still works (this section sits ABOVE it, not inside it) ─────────
{
  const page = await load();
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean));
  ok(tabs.some((x) => /^All$/i.test(x)) && tabs.some((x) => /^Bulletins$/i.test(x)),
     `the All/News/Bulletins toggle is untouched (${tabs.join(" · ")})`);
  // "Bulletins" (owner posts) and "Notices" (town board) must stay different words, or a
  // reader learns to distrust both.
  const txt = await bodyText(page);
  ok(/Notices/.test(txt) && /Bulletins/.test(txt), "notices and bulletins are named differently on the same screen");
  await page.close();
}

// ── 6. No notices → no empty heading ─────────────────────────────────────────────────────
{
  const page = await load({ empty: "1" });
  const txt = await bodyText(page);
  ok(!/Notices/.test(txt), "no Notices heading when there are none");
  ok(/Community/i.test(txt), "…and the rest of the screen still renders (control)");
  await page.close();
}

// ── 7. Spanish — and the word must NOT collide with the bulletins tab ────────────────────
// ES already uses "Avisos" for owner bulletins, so notices must not reuse it; that would
// recreate in Spanish exactly the one-word-two-meanings problem avoided in English.
{
  const page = await load({ lang: "es" });
  await page.click("details summary");
  const txt = await bodyText(page);
  ok(/Anuncios/.test(txt), "the Spanish notices heading renders");
  ok(/Fijado/.test(txt), "the Spanish pinned badge renders");
  ok(/Anuncios anteriores \(1\)/.test(txt), "the Spanish Past notices disclosure renders");
  ok(/2 jul 2000|2 de jul|jul 2, 2000/i.test(txt),
     `the Spanish date renders with a year (${(txt.match(/\d{1,2} \w{3,} \d{4}|\w{3} \d{1,2}, \d{4}/g) ?? []).join(" · ") || "NONE"})`);
  ok(!/Notices|Pinned/.test(txt), "no English leaks into the Spanish render");
  const iA = txt.indexOf("Anuncios"), iAv = txt.indexOf("Avisos");
  ok(iA > -1 && iAv > -1 && iA !== iAv, "'Anuncios' (notices) and 'Avisos' (bulletins) are both present and distinct");
  await page.close();
}

// ── 8. A failed notices query must not look like there are simply no town notices ───────
{
  const page = await load({ fail: "1" });
  const out = await page.evaluate(() => ({
    text: document.body.innerText,
    alerts: document.querySelectorAll('[role="alert"]').length,
    retries: [...document.querySelectorAll("button")].filter((b) => /try again/i.test(b.innerText)).length,
  }));
  ok(/Couldn't load town notices/i.test(out.text), "a notices fetch failure is named instead of silently hiding the section");
  ok(out.alerts > 0 && out.retries > 0, `the notices failure is retryable and accessible (${out.alerts}/${out.retries})`);
  await page.close();
}

await browser.close();
server.kill();

// ── 9. The SOURCE's own ordering ─────────────────────────────────────────────────────────
// The screen tests inject their own source, so they prove the screen renders what it is
// handed — they cannot catch a regression in the ordering itself. (Learned on the classes
// section, where deleting the real filter left every screen assertion green.)
{
  const nodeOut = path.join(tmp, "mock.mjs");
  await build({
    entryPoints: [path.join(ROOT, "src/data/mock/MockDataSource.ts")],
    bundle: true, format: "esm", platform: "node", outfile: nodeOut, logLevel: "error",
    absWorkingDir: ROOT, nodePaths: [path.join(ROOT, "node_modules")],
    alias: { "@": path.join(ROOT, "src"), "@config": path.join(ROOT, "compass.config.ts") },
    loader: { ".css": "empty" },
    define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true" },
  });
  const { MockDataSource } = await import(nodeOut);
  const rows = await new MockDataSource().listCommunityNotices();
  ok(rows.length >= 2, `the source returns notices (${rows.length})`);
  ok(rows[0].pinned === true, "the SOURCE puts pinned first");
  ok(+new Date(rows[0].createdAt) < +new Date(rows[1].createdAt),
     "…even when the pinned one is OLDER — proving pin beats recency, not that it happened to be newest");
  const unpinned = rows.filter((r) => !r.pinned).map((r) => +new Date(r.createdAt));
  ok(unpinned.join() === [...unpinned].sort((a, b) => b - a).join(), "unpinned notices are newest-first");
  ok(rows.every((r) => typeof r.createdAt === "string" && r.createdAt.length > 0),
     "every notice carries a timestamp the UI can date");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
