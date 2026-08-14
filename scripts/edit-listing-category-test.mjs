// Edit Listing category round-trip (audit follow-up, 2026-08-14).
// Renders the REAL EditListingScreen against an injected DataSource and captures the exact
// patch `updateBusiness` receives.  Usage:  node scripts/edit-listing-category-test.mjs
//
// THE BUG: `businesses.category` holds the Google Sheet's vocabulary ("food-drink"), and the
// form bound the <select>'s `value` straight to it. A <select> whose value matches no
// <option> renders with NOTHING selected, so an owner editing a synced listing saw a blank
// category box — and any naive fix that normalises the value on load would then write
// "Food & Drink" back on save, which the next Sheet sync overwrites to "food-drink" again,
// churning the row forever.
//
// So the contract under test has two halves, and both matter:
//   1. the dropdown SHOWS the right label for a stored slug, and
//   2. saving WITHOUT touching it does not rewrite the stored value.
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
const PORT = 4472;
const BASE = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

const tmp = mkdtempSync(path.join(tmpdir(), "rc-edit-"));
const entry = path.join(tmp, "entry.tsx");
writeFileSync(entry, `
import { createRoot } from "react-dom/client";
import { createElement as h } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { DataProvider } from "@/data/DataProvider";
import { SessionProvider } from "@/features/account/session";
import { MockDataSource } from "@/data/mock/MockDataSource";
import { EditListingScreen } from "@/features/owner/EditListingScreen";

const BIZ_ID = "b_synced_listing";
// A listing exactly as the Sheet sync leaves it: slug-case category, real content.
const SYNCED = {
  id: BIZ_ID, name: "Pangaea Guild Hall", slug: "pangaea-guild-hall",
  category: new URLSearchParams(location.search).get("cat") ?? "food-drink",
  subcategories: ["Board Games", "Cafe"], description: "Tabletop game haven and cafe.",
  address: "125 SW E St", geo: { lat: 44.27, lng: -121.17 }, photos: [], amenityTags: [],
  claimed: true, verified: false, tier: "free", createdAt: "2026-01-01T00:00:00.000Z",
  recommendCount: 0,
};

window.__patches = [];
function source() {
  const base = new MockDataSource();
  return new Proxy(base, {
    get(t, prop, r) {
      if (prop === "getBusinessById") return async () => SYNCED;
      if (prop === "getBusinessBySlug") return async () => SYNCED;
      if (prop === "updateBusiness") return async (id, patch) => { window.__patches.push(patch); return { ...SYNCED, ...patch }; };
      if (prop === "getProfile") return async () => ({ ownerBusinessId: BIZ_ID });
      if (prop === "saveProfile") return async () => {};
      const v = Reflect.get(t, prop, r);
      return typeof v === "function" ? v.bind(t) : v;
    },
  });
}

localStorage.setItem("rc.profile", JSON.stringify({ ownerBusinessId: BIZ_ID, onboarded: true }));
createRoot(document.getElementById("root")).render(
  h(I18nProvider, null,
    h(DataProvider, { source: source() },
      h(SessionProvider, null,
        h(MemoryRouter, { initialEntries: ["/manage/edit"] },
          h(Routes, null,
            h(Route, { path: "/manage/edit", element: h(EditListingScreen) }),
            h(Route, { path: "/manage", element: h("div", null, "SAVED-AND-RETURNED") })))))),
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

async function load(cat) {
  const page = await browser.newPage();
  await page.setViewport({ width: 437, height: 950, deviceScaleFactor: 2, isMobile: true });
  await page.goto(`${BASE}/?cat=${encodeURIComponent(cat)}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#e-cat", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 400));
  return page;
}
const clickSave = async (page) => {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /save|guardar/i.test(x.innerText));
    b.click();
  });
  await new Promise((r) => setTimeout(r, 900));
};

// ── 1. A SYNCED listing (slug-case) shows the right label, pre-selected ──────────────────
{
  const page = await load("food-drink");
  const sel = await page.evaluate(() => {
    const s = document.querySelector("#e-cat");
    return { value: s.value, selectedLabel: s.options[s.selectedIndex]?.text, selectedIndex: s.selectedIndex,
             optionCount: s.options.length,
             slugOptions: [...s.options].map((o) => o.value).filter((v) => /^[a-z0-9]+(-[a-z0-9]+)+$/.test(v)) };
  });
  ok(sel.selectedIndex >= 0, `dropdown has a real selection, not blank (index ${sel.selectedIndex})`);
  ok(sel.value === "Food & Drink", `stored "food-drink" shows as "${sel.value}"`);
  ok(sel.selectedLabel === "Food & Drink", `the visible option text is the label ("${sel.selectedLabel}")`);
  ok(sel.slugOptions.length === 0, `no slug-case option leaked into the dropdown (${sel.slugOptions.join(", ") || "none"})`);

  // ── 2. Save WITHOUT touching the category — the stored value must pass through ──────────
  await clickSave(page);
  const patches = await page.evaluate(() => window.__patches);
  ok(patches.length === 1, `save fired exactly one update (${patches.length})`);
  const p = patches[0] ?? {};
  ok(!("category" in p),
     `category is OMITTED from the patch when untouched — the synced value is not rewritten (keys: ${Object.keys(p).join(",")})`);
  ok(p.name === "Pangaea Guild Hall", "the rest of the form still saves normally");
  await page.close();
}

// ── 3. Re-picking the SAME category by its label is still "untouched" ────────────────────
// Otherwise an idle click would rewrite "food-drink" → "Food & Drink" and the next Sheet
// sync would flip it straight back, churning the row for no reason.
{
  const page = await load("food-drink");
  await page.select("#e-cat", "Food & Drink");
  await new Promise((r) => setTimeout(r, 300));
  await clickSave(page);
  const p = (await page.evaluate(() => window.__patches))[0] ?? {};
  ok(!("category" in p), `re-selecting the equivalent label counts as UNCHANGED (keys: ${Object.keys(p).join(",")})`);
  await page.close();
}

// ── 4. A GENUINE change is written ───────────────────────────────────────────────────────
{
  const page = await load("food-drink");
  await page.select("#e-cat", "Retail");
  await new Promise((r) => setTimeout(r, 300));
  await clickSave(page);
  const p = (await page.evaluate(() => window.__patches))[0] ?? {};
  ok(p.category === "Retail", `picking a different category IS written (category=${JSON.stringify(p.category)})`);
  await page.close();
}

// ── 5. An owner-entered Title-Case value is untouched, and an uncategorised one still shows ──
{
  const page = await load("Education");
  const v = await page.evaluate(() => document.querySelector("#e-cat").value);
  ok(v === "Education", `an owner-entered display value stays selected as-is ("${v}")`);
  await clickSave(page);
  const p = (await page.evaluate(() => window.__patches))[0] ?? {};
  ok(!("category" in p), "owner-entered value is not rewritten on an untouched save");
  await page.close();
}
{
  // "entertainment" has no tile, so its label isn't in BUSINESS_CATEGORIES — it must still
  // appear (appended) rather than leaving the owner staring at a blank box.
  const page = await load("entertainment");
  const sel = await page.evaluate(() => {
    const s = document.querySelector("#e-cat");
    return { value: s.value, present: [...s.options].some((o) => o.value === "Entertainment") };
  });
  ok(sel.value === "Entertainment" && sel.present,
     `an uncategorised value is appended and selected, not blank ("${sel.value}")`);
  await page.close();
}

await browser.close();
server.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
