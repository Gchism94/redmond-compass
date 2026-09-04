// Error-state regression test (audit 2026-08-13, item 4).
//
// THE BUG: every read screen rendered `isLoading ? <Skeleton/> : data ?? []`, so a failed
// fetch — dropped connection, paused free-tier Supabase, RLS denial, expired token — was
// indistinguishable from "there are genuinely no results". The app confidently told
// residents there were no businesses in Redmond.
//
// This renders the REAL screens against a DataSource whose reads reject, and asserts the
// error state appears and is distinguishable from the empty state. Both halves matter: a
// test that only checks "error UI shows" would still pass if error and empty rendered the
// same words.
//   Usage:  node scripts/error-state-test.mjs
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4457;
const BASE = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

// ─────────────────────────────────────────────────────────────────────────────────────────
// PART 1 — classifyMutationError (pure). An owner-path write can fail four ways that need
// four different fixes; telling them apart is the whole point of surfacing "a real error".
// ─────────────────────────────────────────────────────────────────────────────────────────
{
  const t0 = mkdtempSync(path.join(tmpdir(), "rc-cls-"));
  await build({
    entryPoints: [path.join(ROOT, "src/lib/errors.ts")],
    bundle: true, format: "esm", platform: "node", outfile: path.join(t0, "errors.mjs"),
    logLevel: "error", absWorkingDir: ROOT, nodePaths: [path.join(ROOT, "node_modules")],
  });
  const { authErrorKey, classifyMutationError } = await import(path.join(t0, "errors.mjs"));

  const cases = [
    [new TypeError("Failed to fetch"), "network", false, "browser offline / request never landed"],
    [{ message: "NetworkError when attempting to fetch resource" }, "network", false, "firefox network wording"],
    [{ code: "PGRST301", message: "JWT expired" }, "session", true, "expired token"],
    [{ message: "JWT expired" }, "session", true, "expired token without a code"],
    [{ code: "42501", message: "new row violates row-level security policy" }, "permission", false, "RLS refusal"],
    [{ code: "23505", message: 'duplicate key value violates unique constraint "businesses_slug_key"' }, "conflict", false, "unique violation"],
    [{ code: "P0001", message: "Sign in to claim a listing" }, "session", true, "our own claim_business RAISE"],
    [{ code: "P0001", message: "This listing is already claimed" }, "permission", false, "a non-auth RAISE"],
    [new Error("kaboom"), "unknown", false, "anything else"],
  ];
  for (const [err, kind, needsAuth, label] of cases) {
    const got = classifyMutationError(err);
    ok(got.kind === kind && got.needsAuth === needsAuth,
       `classify: ${label} → ${kind}${needsAuth ? " (needs sign-in)" : ""} (got ${got.kind}/${got.needsAuth})`);
  }
  // Postgres RAISE messages are authored for humans, so they're shown verbatim…
  ok(classifyMutationError({ code: "P0001", message: "Sign in to claim a listing" }).serverMessage
       === "Sign in to claim a listing",
     "classify: our own RAISE message is passed through verbatim");
  // …but a raw driver string never is; it would be noise to a business owner.
  ok(classifyMutationError({ code: "23505", message: 'duplicate key value violates unique constraint "x"' }).serverMessage
       === undefined,
     "classify: raw Postgres driver text is NOT shown to the user");
  ok(classifyMutationError(null).kind === "unknown", "classify: null doesn't throw");

  ok(authErrorKey(Object.assign(new Error("{}"), { status: 500, code: "unexpected_failure" }), "auth.sendFailed")
       === "auth.sendFailed",
     "auth classify: empty provider error uses safe email fallback");
  ok(authErrorKey(new Error("gomail: SMTP password rejected"), "auth.sendFailed") === "auth.sendFailed",
     "auth classify: SMTP internals are never exposed");
  ok(authErrorKey(new TypeError("Failed to fetch"), "auth.googleFailed") === "auth.networkFailed",
     "auth classify: network failures remain actionable");
  ok(authErrorKey({ status: 429, message: "Too Many Requests" }, "auth.sendFailed") === "auth.rateLimited",
     "auth classify: rate limits get specific guidance");
}

// A harness page that mounts the real app with an injected DataSource. `DataProvider`
// already accepts a `source` prop for exactly this (tests/stories), so no app code changes
// and no network stubbing is needed — the failure is injected at the seam the app defines.
const tmp = mkdtempSync(path.join(tmpdir(), "rc-err-"));
const entry = path.join(tmp, "entry.tsx");
writeFileSync(entry, `
import { createRoot } from "react-dom/client";
import { createElement as h } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { DataProvider } from "@/data/DataProvider";
import { SessionProvider } from "@/features/account/session";
import { MockDataSource } from "@/data/mock/MockDataSource";
import { EventsScreen } from "@/features/events/EventsScreen";
import { ResourcesScreen } from "@/features/resources/ResourcesScreen";
import { SavedScreen } from "@/features/saved/SavedScreen";
import { SubmitEventScreen } from "@/features/owner/SubmitEventScreen";
import { OwnerDashboard } from "@/features/owner/OwnerDashboard";

const SCREENS = { events: EventsScreen, resources: ResourcesScreen, saved: SavedScreen, submitEvent: SubmitEventScreen };

// mode=fail      → every read rejects, as a dropped connection would
// mode=empty     → every read succeeds with nothing, the genuine no-results case
// mode=writefail → reads fine, WRITES reject — the owner-mutation case (item 5).
//                  The thrown shape mimics a real PostgREST RLS refusal.
function makeSource(mode, writeError) {
  const base = new MockDataSource();
  return new Proxy(base, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv);
      if (typeof v !== "function") return v;
      const isRead = /^(list|get|search|has|count)/.test(String(prop));
      if (mode === "writefail") {
        if (isRead) return v.bind(target);
        return () => Promise.reject(writeError);
      }
      if (!isRead) return v.bind(target);
      if (mode === "fail") {
        return () => Promise.reject(new Error("TypeError: Failed to fetch"));
      }
      return async (...a) => {
        const r = await v.apply(target, a);
        if (Array.isArray(r)) return [];
        if (r && typeof r === "object" && "items" in r) return { items: [], total: 0 };
        return Array.isArray(r) ? [] : r;
      };
    },
  });
}

const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "fail";
const which = params.get("screen") ?? "events";
const Screen = SCREENS[which];

const WRITE_ERRORS = {
  rls: { code: "42501", message: "new row violates row-level security policy" },
  session: { code: "PGRST301", message: "JWT expired" },
  network: new TypeError("Failed to fetch"),
};

// ── Session-expiry harness (item 6) ──────────────────────────────────────────────────
// A session that is VALID AT MOUNT and goes invalid on the next check — the real
// scenario (expired mid-visit), not expired-before-arrival. window.__expireSession()
// fires the auth listener with null, exactly as supabase-js does when a token refresh
// fails or the session is revoked.
function makeExpiringSource(businessId, profileFail) {
  const base = new MockDataSource();
  const listeners = new Set();
  const user = { id: "u_test", email: "owner@example.com", name: "Owner" };
  let current = user;
  window.__expireSession = () => { current = null; listeners.forEach((cb) => cb(null)); };
  return new Proxy(base, {
    get(target, prop, recv) {
      if (prop === "getAuthUser") return async () => current;
      if (prop === "onAuthChange") return (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
      // profileFail reproduces bug #1: the sign-in profile merge rejects on a network blip.
      if (prop === "getProfile" && profileFail) return async () => { throw new TypeError("Failed to fetch"); };
      if (prop === "getProfile") return async () => ({ ownerBusinessId: businessId });
      if (prop === "saveProfile") return async () => {};
      const v = Reflect.get(target, prop, recv);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

async function bootExpiry() {
  const probe = new MockDataSource();
  const biz = (await probe.listBusinesses({ limit: 1 })).items[0];
  // Seed real saves too, so the "saves are cleared" assertion can actually fail.
  localStorage.setItem("rc.profile", JSON.stringify({
    ownerBusinessId: biz.id, onboarded: true,
    savedBusinessIds: [biz.id], followedBusinessIds: [biz.id],
  }));
  createRoot(document.getElementById("root")).render(
    h(I18nProvider, null,
      h(DataProvider, { source: makeExpiringSource(biz.id, params.get("profileFail") === "1") },
        h(SessionProvider, null,
          h(MemoryRouter, { initialEntries: ["/manage"] },
            h(Routes, null,
              h(Route, { path: "/manage", element: h(OwnerDashboard) }),
              h(Route, { path: "/claim", element: h("div", null, "CLAIM-SCREEN-REACHED") })))))),
  );
}

async function boot() {
  if (which === "ownerExpiry") return bootExpiry();
  // Owner screens key off session.ownerBusinessId, which lives in the local profile. Seed
  // it with a REAL seed business so the screen gets past its own owner guard.
  if (which === "submitEvent") {
    const probe = new MockDataSource();
    const first = (await probe.listBusinesses({ limit: 1 })).items[0];
    localStorage.setItem("rc.profile", JSON.stringify({ ownerBusinessId: first.id, onboarded: true }));
  }
  const source = makeSource(mode, WRITE_ERRORS[params.get("writeError") ?? "rls"]);
  createRoot(document.getElementById("root")).render(
    h(I18nProvider, null,
      h(DataProvider, { source },
        h(SessionProvider, null,
          h(MemoryRouter, { initialEntries: ["/"] },
            h(Routes, null, h(Route, { path: "/", element: h(Screen) })))))),
  );
}
boot();
`);

const outdir = path.join(tmp, "site");
const testConfig = path.join(tmp, "compass.config.ts");
writeFileSync(testConfig, `export const compassConfig = { siteMode: "full-site", liveSite: "https://redmondcompass.com", appOrigin: "http://localhost:${PORT}" };`);
await build({
  entryPoints: [entry],
  bundle: true, format: "esm", platform: "browser",
  outfile: path.join(outdir, "app.js"), logLevel: "error", jsx: "automatic",
  // The entry lives in a temp dir, so react/react-dom must be resolved from the project.
  absWorkingDir: ROOT,
  nodePaths: [path.join(ROOT, "node_modules")],
  alias: { "@": path.join(ROOT, "src"), "@config": testConfig },
  loader: { ".css": "empty" },
  define: {
    "import.meta.env.DEV": "false",
    "import.meta.env.VITE_DATA_SOURCE": '"mock"',
    "import.meta.env.VITE_SUPABASE_URL": '""',
    "import.meta.env.VITE_SUPABASE_ANON_KEY": '""',
    "process.env.NODE_ENV": '"production"',
  },
});
writeFileSync(path.join(outdir, "index.html"),
  `<!doctype html><html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`);

const server = spawn("npx", ["--yes", "http-server", outdir, "-p", String(PORT), "-s"], { stdio: "ignore" });
for (let i = 0; ; i++) {
  try { await fetch(BASE); break } catch {
    await new Promise((r) => setTimeout(r, 300));
    if (i > 60) { server.kill(); throw new Error("harness server did not start"); }
  }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

async function render(screen, mode) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/?screen=${screen}&mode=${mode}`, { waitUntil: "networkidle0" });
  await page.waitForFunction(
    () => !document.body.innerText.includes("​") && document.body.innerText.trim().length > 0,
    { timeout: 8000 },
  ).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  const out = await page.evaluate(() => ({
    text: document.body.innerText,
    alerts: document.querySelectorAll('[role="alert"]').length,
    retries: [...document.querySelectorAll("button")].filter((b) => /try again|intentar/i.test(b.innerText)).length,
  }));
  await page.close();
  return out;
}

for (const screen of ["events", "resources", "saved"]) {
  const failed = await render(screen, "fail");
  const empty = await render(screen, "empty");

  ok(failed.alerts > 0, `[${screen}] error state renders a role="alert" region (${failed.alerts})`);
  ok(failed.retries > 0, `[${screen}] error state offers a retry action (${failed.retries})`);
  ok(/couldn't load|no se pudo|no se pudieron/i.test(failed.text),
     `[${screen}] error copy says it couldn't LOAD`);

  // The core assertion: error and empty must not look the same.
  ok(failed.text.trim() !== empty.text.trim(),
     `[${screen}] error text differs from empty text (not the same screen twice)`);
  ok(empty.alerts === 0 && empty.retries === 0,
     `[${screen}] the genuine empty state has NO alert and NO retry (${empty.alerts}/${empty.retries})`);

  // The specific regression: a failure must never claim there is nothing here.
  const emptyPhrases = empty.text.match(/nothing|no events|no results|empty|check back/gi) ?? [];
  const failedClaimsEmpty = emptyPhrases.some((p) => failed.text.toLowerCase().includes(p.toLowerCase()));
  ok(!failedClaimsEmpty,
     `[${screen}] error screen does NOT reuse the empty screen's "nothing here" wording`);
}

// Saved carries an extra promise: an error there reads as "your saves are gone".
const savedFailed = await render("saved", "fail");
ok(/saves are safe|guardados están a salvo/i.test(savedFailed.text),
   "[saved] error reassures the user their saved list is intact, not lost");

// ─────────────────────────────────────────────────────────────────────────────────────────
// PART 3 — a failing owner WRITE (item 5). Fills the real Submit Event form, submits it
// against a source whose writes reject, and checks the three things that were broken:
// the failure is reported, the typing survives, and the button becomes usable again.
// ─────────────────────────────────────────────────────────────────────────────────────────
async function submitFailingEvent(writeError) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/?screen=submitEvent&mode=writefail&writeError=${writeError}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#ev-title", { timeout: 8000 });
  const TITLE = "Live acoustic night";
  await page.type("#ev-title", TITLE);
  await page.evaluate(() => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      const proto = Object.getPrototypeOf(el);
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("ev-date", "2026-12-01");
    set("ev-start", "19:00");
  });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /submit event|enviar evento/i.test(x.innerText));
    b.click();
  });
  await new Promise((r) => setTimeout(r, 900));
  const out = await page.evaluate((title) => ({
    text: document.body.innerText,
    alerts: document.querySelectorAll('[role="alert"]').length,
    titleStillFilled: document.getElementById("ev-title")?.value === title,
    submitDisabled: [...document.querySelectorAll("button")]
      .find((x) => /submit event|enviar evento/i.test(x.innerText))?.disabled ?? null,
  }), TITLE);
  await page.close();
  return out;
}

const rls = await submitFailingEvent("rls");
ok(rls.alerts > 0, `[submitEvent] a failed write reports an error instead of silently doing nothing (${rls.alerts})`);
ok(/permission|permiso/i.test(rls.text), "[submitEvent] RLS refusal is named as a permission problem");
ok(rls.titleStillFilled, "[submitEvent] the owner's typing SURVIVES a failed submit");
ok(rls.submitDisabled === false, "[submitEvent] the submit button re-enables after failure (not stuck pending)");

// An expired session must offer sign-in, not a retry that is guaranteed to fail again.
const expired = await submitFailingEvent("session");
ok(/expired|caducado/i.test(expired.text), "[submitEvent] an expired session says so, rather than a generic error");
const hasSignIn = /sign in|iniciar sesión/i.test(expired.text);
ok(hasSignIn, "[submitEvent] expired session offers SIGN IN as the action, not 'Try again'");

const offline = await submitFailingEvent("network");
ok(/offline|conexión/i.test(offline.text), "[submitEvent] a network failure says you're offline");

// ─────────────────────────────────────────────────────────────────────────────────────────
// PART 4 — session expires MID-VISIT while the owner sits on /manage (item 6).
// The session is valid at mount, then revoked — matching a real token-refresh failure,
// not an already-dead session on arrival.
// ─────────────────────────────────────────────────────────────────────────────────────────
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/?screen=ownerExpiry`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1200));

  const before = await page.evaluate(() => ({
    text: document.body.innerText,
    ownerId: JSON.parse(localStorage.getItem("rc.profile") ?? "{}").ownerBusinessId ?? null,
    saved: JSON.parse(localStorage.getItem("rc.profile") ?? "{}").savedBusinessIds ?? null,
  }));
  ok(!/CLAIM-SCREEN-REACHED/.test(before.text) && before.text.trim().length > 0,
     "[ownerExpiry] owner is ON the dashboard while the session is valid (precondition)");
  ok(!!before.ownerId, `[ownerExpiry] ownerBusinessId is set before expiry (${before.ownerId})`);
  ok((before.saved ?? []).length > 0,
     `[ownerExpiry] account-scoped saves exist before expiry (${(before.saved ?? []).length}) — so the clear assertion below can fail`);

  // Revoke the session, exactly as a failed token refresh would.
  await page.evaluate(() => window.__expireSession());
  await new Promise((r) => setTimeout(r, 1200));

  const after = await page.evaluate(() => ({
    text: document.body.innerText,
    ownerId: JSON.parse(localStorage.getItem("rc.profile") ?? "{}").ownerBusinessId ?? null,
    saved: JSON.parse(localStorage.getItem("rc.profile") ?? "{}").savedBusinessIds ?? null,
  }));
  ok(after.ownerId === null,
     `[ownerExpiry] ownerBusinessId is CLEARED when the session dies (got ${JSON.stringify(after.ownerId)})`);
  ok(/CLAIM-SCREEN-REACHED/.test(after.text),
     "[ownerExpiry] owner is routed OFF /manage rather than sitting on a screen that can't work");
  ok(Array.isArray(after.saved) && after.saved.length === 0,
     "[ownerExpiry] account-scoped saves are cleared too (same as explicit sign-out)");

  await page.close();
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// PART 5 — the sign-in profile merge fails (item 6, bug #1). The literal symptom was an
// UNHANDLED promise rejection, after which prefs silently stopped reaching the server for
// the rest of the session.
// ─────────────────────────────────────────────────────────────────────────────────────────
{
  const page = await browser.newPage();
  const unhandled = [];
  const logged = [];
  page.on("pageerror", (e) => unhandled.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") logged.push(m.text()); });
  await page.evaluateOnNewDocument(() => {
    window.__unhandled = [];
    window.addEventListener("unhandledrejection", (e) => window.__unhandled.push(String(e.reason)));
  });
  await page.goto(`${BASE}/?screen=ownerExpiry&profileFail=1`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1400));
  const res = await page.evaluate(() => ({
    unhandled: window.__unhandled ?? [],
    text: document.body.innerText,
  }));
  ok(res.unhandled.length === 0,
     `[profileSync] a failed merge produces NO unhandled rejection (${JSON.stringify(res.unhandled).slice(0, 120)})`);
  ok(logged.some((l) => /profile sync failed/i.test(l)),
     "[profileSync] the failure is logged rather than swallowed");
  ok(!/CLAIM-SCREEN-REACHED/.test(res.text),
     "[profileSync] a failed merge does NOT sign the user out — they stay where they were");
  await page.close();
}

// A guest cold start must NOT be mistaken for a session loss — apply(null) fires before any
// session restores, and wiping a guest's local-first saves there would be a nasty regression.
{
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("rc.profile", JSON.stringify({ savedBusinessIds: ["b_juniper"], onboarded: true }));
  });
  await page.goto(`${BASE}/?screen=saved&mode=empty`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("rc.profile") ?? "{}").savedBusinessIds ?? [],
  );
  ok(saved.includes("b_juniper"),
     "[guest] a guest's local saves SURVIVE cold start (session-loss clear is guarded on having had a user)");
  await page.close();
}

await browser.close();
server.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
