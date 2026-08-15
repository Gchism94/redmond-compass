// Guest-local save/follow + sign-in merge (Save/Follow investment, 2026-08-14).
//
// TWO THINGS ARE UNDER TEST, and the second is where the real risk lives.
//
// 1. THE WALL IS GONE. Save / Follow / Save-event used to route through `requireAuth`,
//    which opened the AuthSheet and deferred the tap. A guest could tell the app their
//    interests and home location during onboarding — never gated — but could not bookmark
//    a coffee shop. These assert the tap LANDS as a guest and raises no auth prompt.
//
// 2. THE MERGE DOES NOT LOSE DATA. Guest-local saves only work if signing in UNIONS them
//    with whatever the account already holds. The two ways to get this wrong are silent
//    and symmetrical: local clobbers server (you sign in on a new phone and your old
//    saves vanish), or server clobbers local (everything you saved before signing up
//    vanishes). Both leave a plausible-looking list, which is why this asserts the
//    CONTENTS after a real sign-in — and asserts what `saveProfile` was handed, because a
//    merge that looks right on screen but pushes a truncated list up is the same bug one
//    reload later.
//
//    It also covers the sign-out path, which changed meaning: clearing account lists was
//    safe when saves required an account. Now, if the sign-in merge FAILED, local state is
//    the only copy that exists and clearing it destroys it.
//
//   node scripts/guest-save-test.mjs
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
const PORT = 4479;
const BASE = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

const tmp = mkdtempSync(path.join(tmpdir(), "rc-guest-"));
const entry = path.join(tmp, "entry.tsx");
writeFileSync(entry, `
import { createRoot } from "react-dom/client";
import { createElement as h } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { DataProvider } from "@/data/DataProvider";
import { SessionProvider, useSession } from "@/features/account/session";
import { MockDataSource } from "@/data/mock/MockDataSource";
import { HomeScreen } from "@/features/directory/HomeScreen";
import { ResultsScreen } from "@/features/directory/ResultsScreen";

const q = new URLSearchParams(location.search);
// What the ACCOUNT already holds server-side (the other half of the merge).
const SERVER = q.get("server") ? JSON.parse(q.get("server")) : null;
// Make getProfile reject, to exercise the failed-merge branch.
const FAIL_SYNC = q.get("failsync") === "1";

window.__saveProfileCalls = [];
function source() {
  const base = new MockDataSource();
  return new Proxy(base, {
    get(t, prop, r) {
      if (prop === "getProfile") return async () => {
        if (FAIL_SYNC) throw new Error("simulated getProfile failure");
        return SERVER;
      };
      if (prop === "saveProfile") return async (patch) => { window.__saveProfileCalls.push(patch); };
      // The mock's seeded events are all July 2026, and Home filters to UPCOMING — so on
      // any run after that date its events rail is empty and there is nothing to click.
      // The rail's save control is what we're testing, not the seed's shelf life, so pin a
      // guaranteed-future event. (This is the same time-dependence that would have made
      // this test quietly pass in July and fail in August.)
      if (prop === "listEvents") return async (query = {}) => {
        const future = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 19);
        const ev = {
          id: "e_future", title: "Test Future Event", description: "always upcoming",
          startAt: future, venueName: "Centennial Park",
          address: "529 SW 7th St, Redmond, OR", geo: { lat: 44.2726, lng: -121.1739 },
          status: "upcoming", category: "Community",
        };
        const real = await base.listEvents(query);
        return [ev, ...real];
      };
      const v = Reflect.get(t, prop, r);
      return typeof v === "function" ? v.bind(t) : v;
    },
  });
}
const SRC = source();

/** Exposes the live session so the test can drive sign-in/out precisely. */
function Probe() {
  const s = useSession();
  window.__session = s;
  window.__authOpen = s.authPrompt.open;
  return null;
}

createRoot(document.getElementById("root")).render(
  h(I18nProvider, null,
    h(DataProvider, { source: SRC },
      h(SessionProvider, null,
        h(MemoryRouter, { initialEntries: [q.get("route") ?? "/home"] },
          h(Probe),
          h(Routes, null,
            h(Route, { path: "/home", element: h(HomeScreen) }),
            h(Route, { path: "/search/results", element: h(ResultsScreen) })))))),
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

async function load({ route = "/home", server: srv = null, failsync = false, local = null } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 437, height: 950, deviceScaleFactor: 2, isMobile: true });
  // Seed the guest's device BEFORE the app boots, so it is the profile the session loads.
  if (local) {
    await page.evaluateOnNewDocument((p) => {
      localStorage.setItem("rc.profile", JSON.stringify(p));
    }, local);
  }
  const qs = new URLSearchParams({ route });
  if (srv) qs.set("server", JSON.stringify(srv));
  if (failsync) qs.set("failsync", "1");
  await page.goto(`${BASE}/?${qs}`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => !!window.__session, { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 700));
  return page;
}
const profileOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("rc.profile") ?? "{}"));
const sess = (page) => page.evaluate(() => ({
  saved: window.__session.savedBusinessIds,
  followed: window.__session.followedBusinessIds,
  savedEvents: window.__session.savedEventIds,
  authed: window.__session.isAuthed,
  authOpen: window.__session.authPrompt.open,
  syncFailed: window.__session.profileSyncFailed,
}));

// ── 1. A GUEST can save from Home — the wall is gone, and the rail renders a control ─────
{
  const page = await load();
  const before = await sess(page);
  ok(!before.authed, "starts as a guest (control)");

  // The Home rail card is one big <Link>; the save control is the overlay button on it.
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('a[href^="/b/"] button[aria-label]');
    if (!btn) return null;
    btn.click();
    return btn.getAttribute("aria-label");
  });
  ok(clicked !== null, `Home's rail renders a save control (${clicked ?? "NOT FOUND"})`);
  await new Promise((r) => setTimeout(r, 400));

  const after = await sess(page);
  ok(after.saved.length === 1, `a guest's tap SAVED immediately (${after.saved.length})`);
  ok(!after.authOpen, "no auth sheet was raised");
  ok(!after.authed, "and the guest was not signed in behind their back");

  const stored = await profileOf(page);
  ok((stored.savedBusinessIds ?? []).length === 1,
     "the save is persisted to localStorage, so it survives a reload");

  // Tapping the same control again un-saves (it is a toggle, not an append).
  await page.evaluate(() => document.querySelector('a[href^="/b/"] button[aria-label]').click());
  await new Promise((r) => setTimeout(r, 300));
  ok((await sess(page)).saved.length === 0, "tapping again un-saves");
  await page.close();
}

// ── 2. A GUEST can follow from a result card (second entry point) ─────────────────────────
{
  const page = await load({ route: "/search/results" });
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")));
  ok(labels.some((l) => /follow|seguir/i.test(l ?? "")),
     "ResultCard offers a follow control outside the business profile");

  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button[aria-label]")].find((x) => /follow|seguir/i.test(x.getAttribute("aria-label")));
    b.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const after = await sess(page);
  ok(after.followed.length === 1, `a guest's follow LANDED (${after.followed.length})`);
  ok(!after.authOpen, "following raised no auth sheet either");
  await page.close();
}

// ── 3. A GUEST can save an event from Home ────────────────────────────────────────────────
{
  const page = await load();
  const found = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button[aria-label]")]
      .find((x) => /save event|guardar evento/i.test(x.getAttribute("aria-label") ?? ""));
    if (!b) return false;
    b.click();
    return true;
  });
  ok(found, "Home's events rail renders a save control");
  await new Promise((r) => setTimeout(r, 400));
  ok((await sess(page)).savedEvents.length === 1, "a guest's event save landed");
  await page.close();
}

// ── 4. THE MERGE — the failure case, not the happy path ──────────────────────────────────
// Guest saved A/F1/E1 on this device. The account they sign into ALREADY holds B/F2/E2 from
// another device. Neither side may win: a union is the only answer that loses nothing.
{
  const page = await load({
    local: { savedBusinessIds: ["biz_local"], followedBusinessIds: ["f_local"], savedEventIds: ["e_local"] },
    server: { savedBusinessIds: ["biz_server"], followedBusinessIds: ["f_server"], savedEventIds: ["e_server"] },
  });
  const pre = await sess(page);
  ok(pre.saved.includes("biz_local") && pre.saved.length === 1,
     "guest device starts with only its own local save (control)");

  await page.evaluate(() => window.__session.signInWithProvider("google"));
  await page.waitForFunction(() => window.__session.isAuthed, { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 900));

  const post = await sess(page);
  ok(post.authed, "signed in (control)");
  ok(post.saved.includes("biz_local"), "GUEST's save survived sign-in (server did not clobber local)");
  ok(post.saved.includes("biz_server"), "ACCOUNT's save arrived (local did not clobber server)");
  ok(post.saved.length === 2, `saves are the union, not one side (${JSON.stringify(post.saved)})`);
  ok(post.followed.length === 2 && post.followed.includes("f_local") && post.followed.includes("f_server"),
     `follows merged both ways (${JSON.stringify(post.followed)})`);
  ok(post.savedEvents.length === 2, `saved events merged both ways (${JSON.stringify(post.savedEvents)})`);

  // A merge that renders correctly but PUSHES a truncated list is the same data loss,
  // one reload later — so assert what actually went up.
  const pushed = await page.evaluate(() => window.__saveProfileCalls);
  ok(pushed.length >= 1, `the merged profile was pushed to the server (${pushed.length} call(s))`);
  const last = pushed[pushed.length - 1] ?? {};
  ok((last.savedBusinessIds ?? []).includes("biz_local") && (last.savedBusinessIds ?? []).includes("biz_server"),
     `the PUSHED payload carries both sides (${JSON.stringify(last.savedBusinessIds)})`);

  // No duplicates when both sides already hold the same id.
  ok(new Set(post.saved).size === post.saved.length, "no duplicate ids after the merge");
  await page.close();
}

// ── 4b. Overlapping ids merge to ONE entry ───────────────────────────────────────────────
{
  const page = await load({
    local: { savedBusinessIds: ["same", "only_local"] },
    server: { savedBusinessIds: ["same", "only_server"] },
  });
  await page.evaluate(() => window.__session.signInWithProvider("google"));
  await page.waitForFunction(() => window.__session.isAuthed, { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 900));
  const post = await sess(page);
  ok(post.saved.length === 3 && new Set(post.saved).size === 3,
     `overlap de-duplicates rather than doubling (${JSON.stringify(post.saved)})`);
  await page.close();
}

// ── 5. SIGN-OUT after a SUCCESSFUL merge clears the device ───────────────────────────────
// The server has a copy, so clearing loses nothing and keeps one person's saves off the
// next person's screen on a shared device.
{
  const page = await load({
    local: { savedBusinessIds: ["biz_local"] },
    server: { savedBusinessIds: ["biz_server"] },
  });
  await page.evaluate(() => window.__session.signInWithProvider("google"));
  await page.waitForFunction(() => window.__session.isAuthed, { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 800));
  ok((await sess(page)).saved.length === 2, "merged before sign-out (control)");

  await page.evaluate(() => window.__session.signOut());
  await new Promise((r) => setTimeout(r, 800));
  const post = await sess(page);
  ok(post.saved.length === 0,
     `sign-out clears the device when the server holds a copy (${JSON.stringify(post.saved)})`);
}

// ── 6. SIGN-OUT after a FAILED merge KEEPS the saves ─────────────────────────────────────
// This is the path guest-local saves created. If getProfile() threw, nothing from the
// account was ever loaded and nothing local was ever pushed — local state is the ONLY copy
// in existence. Clearing it would be the one move here that destroys data permanently.
{
  const page = await load({
    local: { savedBusinessIds: ["biz_guest_only"] },
    failsync: true,
  });
  await page.evaluate(() => window.__session.signInWithProvider("google"));
  await page.waitForFunction(() => window.__session.isAuthed, { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 900));
  const mid = await sess(page);
  ok(mid.syncFailed, "the merge failure is surfaced, not swallowed (control)");
  ok(mid.saved.includes("biz_guest_only"), "the guest's save is still on screen (control)");

  await page.evaluate(() => window.__session.signOut());
  await new Promise((r) => setTimeout(r, 800));
  const post = await sess(page);
  ok(post.saved.includes("biz_guest_only"),
     `sign-out KEEPS saves the server never received — no permanent loss (${JSON.stringify(post.saved)})`);
  const stored = await profileOf(page);
  ok((stored.savedBusinessIds ?? []).includes("biz_guest_only"),
     "and they are still on disk, so a reload recovers them");
  await page.close();
}

await browser.close();
server.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
