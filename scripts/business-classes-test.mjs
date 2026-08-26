// Business classes on the profile (item 5, 2026-08-15).
//
// Renders the REAL BusinessProfileScreen against an injected DataSource and asserts what a
// visitor actually sees. Three things carry real risk:
//
// 1. UPCOMING ONLY. 4 of the 10 live rows are already past. A section that leads with a
//    June class on an August profile is worse than no section — it reads as "this business
//    stopped doing things".
//
// 2. THE DATE MUST NOT SHIFT. `business_classes.date` is a Postgres `date` — a day on a
//    calendar, with no instant attached. `new Date("2026-08-17")` parses as UTC midnight,
//    which in Redmond (UTC-7/-8) renders as the 16th. A class would advertise the wrong
//    day, and nothing about the page would look broken. Asserted explicitly.
//
// 3. NO SECTION WHEN THERE ARE NO CLASSES. Exactly one of 133 businesses has any, so 132
//    profiles must not grow an empty heading.
//
//   node scripts/business-classes-test.mjs
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
const PORT = 4481;
const BASE = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

const tmp = mkdtempSync(path.join(tmpdir(), "rc-bc-"));
const entry = path.join(tmp, "entry.tsx");
writeFileSync(entry, `
import { createRoot } from "react-dom/client";
import { createElement as h } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { DataProvider } from "@/data/DataProvider";
import { SessionProvider } from "@/features/account/session";
import { MockDataSource } from "@/data/mock/MockDataSource";
import { BusinessProfileScreen } from "@/features/directory/BusinessProfileScreen";

const q = new URLSearchParams(location.search);
localStorage.setItem("rc.lang", q.get("lang") ?? "en");

const BIZ = {
  id: "b_test", name: "Imaginary Rebel Art Studio", slug: "imaginary-rebel-art-studio",
  category: "entertainment", subcategories: ["Art Classes"],
  description: "Paint parties and workshops.", longDescription: "Paint parties and workshops.",
  address: "SCP Hotel Downtown Redmond", geo: { lat: 44.27, lng: -121.17 },
  photos: [], amenityTags: [], claimed: false, verified: false, tier: "free",
  createdAt: "2026-01-01T00:00:00.000Z", recommendCount: 0,
};

// Dates are computed relative to NOW so the fixture cannot expire — the same trap that
// silently emptied Home's events rail when the July-2026 seeds aged out.
const pad = (n) => String(n).padStart(2, "0");
const ymd = (n) => { const d = new Date(); d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const ALL = [
  { id: "c_past2", businessId: "b_test", title: "PAST Wide Brim Hat Party", date: ymd(-47), status: "sold_out", createdAt: "x" },
  { id: "c_past1", businessId: "b_test", title: "PAST Patriotic Gnome Party", date: ymd(-9), status: "open", createdAt: "x" },
  { id: "c_soon",  businessId: "b_test", title: "Fall Highlander Cow Paint Party", date: ymd(2),
    location: "SCP Hotel Redmond", link: "https://example.com/book", status: "open", createdAt: "x" },
  { id: "c_sold",  businessId: "b_test", title: "Halloween Gnome Paint Party", date: ymd(30),
    status: "sold_out", createdAt: "x" },
  { id: "c_wait",  businessId: "b_test", title: "Crate of Pumpkins Paint Party", date: ymd(60),
    timeText: "6:00–8:00 PM", status: "waitlist", createdAt: "x" },
];
window.__EXPECT_SOON_DATE = ALL[2].date;

const EMPTY = q.get("empty") === "1";
const FAIL = q.get("fail") === "1";
// "raw" serves the UNFILTERED list, to prove the screen is not doing its own filtering —
// the contract is that the DataSource returns upcoming only.
const RAW = q.get("raw") === "1";

function source() {
  const base = new MockDataSource();
  return new Proxy(base, {
    get(t, prop, r) {
      if (prop === "getBusinessBySlug" || prop === "getBusinessById") return async () => BIZ;
      if (prop === "listBulletins") return async () => [];
      if (prop === "listEvents") return async () => [];
      if (prop === "listBusinessClasses") return async () => {
        if (FAIL) throw new TypeError("Failed to fetch");
        if (EMPTY) return [];
        if (RAW) return ALL;
        const today = new Date();
        const t0 = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());
        return ALL.filter((c) => c.date >= t0).sort((a,b) => a.date.localeCompare(b.date));
      };
      const v = Reflect.get(t, prop, r);
      return typeof v === "function" ? v.bind(t) : v;
    },
  });
}

createRoot(document.getElementById("root")).render(
  h(I18nProvider, null,
    h(DataProvider, { source: source() },
      h(SessionProvider, null,
        h(MemoryRouter, { initialEntries: ["/b/imaginary-rebel-art-studio"] },
          h(Routes, null,
            h(Route, { path: "/b/:slug", element: h(BusinessProfileScreen) })))))),
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
  await page.setViewport({ width: 437, height: 1200, deviceScaleFactor: 2, isMobile: true });
  await page.goto(`${BASE}/?${new URLSearchParams(qs)}`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, qs.fail ? 1800 : 900));
  return page;
}
const bodyText = (p) => p.evaluate(() => document.body.innerText);

// ── 1. The section renders, upcoming only ────────────────────────────────────────────────
{
  const page = await load();
  const txt = await bodyText(page);
  ok(/Classes & workshops/i.test(txt), "the Classes section renders");
  ok(/Fall Highlander Cow Paint Party/.test(txt), "an upcoming class is listed");
  ok(!/PAST /.test(txt), `no past class is listed (${(txt.match(/PAST [^\n]*/g) ?? []).join(", ") || "none"})`);

  // Order: soonest first.
  const iSoon = txt.indexOf("Fall Highlander Cow");
  const iLate = txt.indexOf("Crate of Pumpkins");
  ok(iSoon > -1 && iLate > iSoon, "classes are ordered soonest-first");

  // ── 2. THE DATE MUST NOT SHIFT ─────────────────────────────────────────────────────────
  // Compare against the calendar day the fixture asked for, formatted the same way a person
  // reads it. An off-by-one here is invisible on screen and wrong in the world.
  const { expected, shown } = await page.evaluate(() => {
    const ymd = window.__EXPECT_SOON_DATE;
    const [y, m, d] = ymd.split("-").map(Number);
    const want = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    return { expected: want, shown: document.body.innerText };
  });
  ok(shown.includes(expected), `the date renders as the calendar day, not UTC-shifted (expected "${expected}")`);

  // ── 3. status badges + booking link ────────────────────────────────────────────────────
  ok(/Sold out/i.test(txt), "a sold-out class carries its badge");
  ok(/Waitlist/i.test(txt), "a waitlist class carries its badge");
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href="https://example.com/book"]')].map((a) => ({
      target: a.target, rel: a.rel, cls: a.className,
    })));
  ok(links.length === 1, `the booking link is rendered (${links.length})`);
  ok(links[0]?.target === "_blank" && /noreferrer/.test(links[0]?.rel ?? ""), "booking link opens safely (_blank + noreferrer)");
  // NOTE: this harness bundles with `loader: { ".css": "empty" }`, so Tailwind utilities do
  // not apply and every element measures at its bare line height — a pixel assertion here
  // would be meaningless (it read 18px for a control that carries min-h-tap). Tap-target
  // enforcement belongs to `npm run smoke`, which runs against the real CSS build. What is
  // checkable here is that the intent is declared.
  ok(/min-h-tap/.test(links[0]?.cls ?? ""), `booking link declares the 44px tap target (${links[0]?.cls ?? "no class"})`);

  // No hotlinked images — every live row points at a third-party Wix CDN.
  const imgs = await page.evaluate(() =>
    [...document.querySelectorAll("img")].map((i) => i.src).filter((s) => /wixstatic|base44/.test(s)));
  ok(imgs.length === 0, `no third-party class images are loaded (${imgs.length})`);
  await page.close();
}

// ── 4. A business with NO classes grows no empty section ─────────────────────────────────
{
  const page = await load({ empty: "1" });
  const txt = await bodyText(page);
  ok(!/Classes & workshops/i.test(txt), "no Classes heading when the business has none");
  ok(/Imaginary Rebel/.test(txt), "…and the rest of the profile still renders (control)");
  await page.close();
}

// ── 5. Spanish ───────────────────────────────────────────────────────────────────────────
{
  const page = await load({ lang: "es" });
  const txt = await bodyText(page);
  ok(/Clases y talleres/i.test(txt), "the section heading is translated");
  ok(/Agotado/i.test(txt), "the sold-out badge is translated");
  ok(/Lista de espera/i.test(txt), "the waitlist badge is translated");
  ok(/Detalles y reservas/i.test(txt), "the booking link is translated");
  ok(!/Classes & workshops|Sold out|Waitlist/i.test(txt), "no English leaks into the Spanish render");
  await page.close();
}

// ── 6. The FILTER belongs to the data source, not the screen ─────────────────────────────
// Serving the unfiltered list proves where the contract lives. If the screen silently
// re-filters, this passes for the wrong reason and the Supabase query could regress unseen.
{
  const page = await load({ raw: "1" });
  const txt = await bodyText(page);
  ok(/PAST /.test(txt),
     "given an unfiltered list the screen renders it verbatim — the upcoming-only contract lives in the DataSource, which is what listBusinessClasses is tested to honour");
  await page.close();
}

// ── 6. Secondary-query failures must not masquerade as "this business has no classes" ──
{
  const page = await load({ fail: "1" });
  const out = await page.evaluate(() => ({
    text: document.body.innerText,
    alerts: document.querySelectorAll('[role="alert"]').length,
    retries: [...document.querySelectorAll("button")].filter((b) => /try again/i.test(b.innerText)).length,
  }));
  ok(/Couldn't load classes and workshops/i.test(out.text), "a classes fetch failure is named instead of silently hiding the section");
  ok(out.alerts > 0 && out.retries > 0, `the classes failure is retryable and accessible (${out.alerts}/${out.retries})`);
  await page.close();
}

// ── 7. The visible Share control must actually invoke the platform share flow ──────────
{
  const page = await load({});
  await page.evaluate(() => {
    window.__sharePayload = null;
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (payload) => { window.__sharePayload = payload; },
    });
  });
  await page.click('button[aria-label="Share"]');
  const payload = await page.evaluate(() => window.__sharePayload);
  ok(payload?.title === "Imaginary Rebel Art Studio", `Share sends the business title (${payload?.title ?? "none"})`);
  ok(typeof payload?.url === "string" && payload.url === await page.url(), "Share sends the current listing URL");
  await page.close();
}

await browser.close();
server.kill();

// ── 8. The DataSource's OWN filter ───────────────────────────────────────────────────────
// The screen tests above inject their own source, so they prove the SCREEN renders what it
// is handed — they cannot catch a regression in the implementation that does the filtering.
// (Verified: deleting the `date >= today` clause from MockDataSource leaves every assertion
// above green.) This drives the real MockDataSource, whose seed deliberately contains one
// past row so there is something to exclude.
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
  const ds = new MockDataSource();
  const rows = await ds.listBusinessClasses("b_juniper");

  const today = new Date();
  const t0 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  ok(rows.length > 0, `the source returns classes for a business that has them (${rows.length})`);
  ok(rows.every((c) => c.date >= t0),
     `the SOURCE filters to upcoming (${rows.map((c) => c.date).join(", ")})`);
  ok(!rows.some((c) => c.id === "bc_past"), "the seeded past class is excluded — the filter has something to do");
  ok(rows.map((c) => c.date).join() === [...rows.map((c) => c.date)].sort().join(),
     "the source returns them soonest-first");
  ok((await ds.listBusinessClasses("b_nonexistent")).length === 0, "a business with no classes gets an empty list");
}

// ── 9. "Today" for the upcoming filter is Redmond's day, wherever the viewer is ─────────
{
  const dateOut = path.join(tmp, "format.mjs");
  await build({
    entryPoints: [path.join(ROOT, "src/lib/format.ts")],
    bundle: true, format: "esm", platform: "node", outfile: dateOut, logLevel: "error",
    absWorkingDir: ROOT, nodePaths: [path.join(ROOT, "node_modules")],
    alias: { "@": path.join(ROOT, "src"), "@config": path.join(ROOT, "compass.config.ts") },
    define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true" },
  });
  const { redmondDateYmd } = await import(dateOut);
  // 06:30Z is already Aug 29 in UTC/New York, but still 11:30 PM Aug 28 in Redmond.
  ok(redmondDateYmd(new Date("2026-08-29T06:30:00.000Z")) === "2026-08-28",
     "upcoming classes use Redmond's calendar day across the midnight boundary");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
