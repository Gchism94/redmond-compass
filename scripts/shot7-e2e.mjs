// E2E smoke: claim flow → JIT sign-in → create listing → dashboard → post bulletin.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.argv[2] || ".";
const BASE = "http://localhost:5173";

const GUEST = {
  onboarded: true, savedBusinessIds: [], followedBusinessIds: [], savedEventIds: [],
  recentlyViewedIds: [], interests: [], location: null,
  notificationPrefs: { followedBulletins: true, savedEvents: true, localNews: false },
  ownerBusinessId: null,
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (page, t) => page.evaluate((t) => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim().startsWith(t));
  b?.click(); return !!b;
}, t);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--hide-scrollbars"] });
const page = await browser.newPage();
page.on("console", (m) => { const t = m.text(); if (/Warning|Error|update a component|render/i.test(t)) console.log("  [console]", t.slice(0, 160)); });
page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 160)));
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
// Seed ONCE (only if absent) — evaluateOnNewDocument runs on every navigation, so a
// blind setItem would clobber the app's persisted profile on reload.
await page.evaluateOnNewDocument((p) => {
  if (!localStorage.getItem("rc.profile")) localStorage.setItem("rc.profile", JSON.stringify(p));
}, GUEST);

await page.goto(`${BASE}/claim`, { waitUntil: "networkidle0" });
await sleep(300);
await clickText(page, "Add a new business");
await sleep(300);
await page.type("#biz-name", "Test Roastery");
await page.type("#biz-addr", "100 Test St, Redmond, OR");
await clickText(page, "Create listing");
await sleep(400); // JIT auth sheet appears (guest)
await page.type('[role="dialog"] input[type="email"]', "owner@example.com");
await clickText(page, "Continue");
await sleep(900); // create + navigate to /manage

const path1 = await page.evaluate(() => location.pathname);
const hasName = await page.evaluate(() => document.body.innerText.includes("Test Roastery"));
console.log(`after create: path=${path1}  dashboardShowsNewBiz=${hasName}`);
await page.screenshot({ path: `${OUT}/s7-e2e-dashboard.png`, fullPage: true });

// Diagnostics: what persisted?
const rawProf = await page.evaluate(() => localStorage.getItem("rc.profile"));
console.log(`raw rc.profile on /manage = ${rawProf}`);

// Post a bulletin (under cap for a brand-new listing)
await page.goto(`${BASE}/manage/bulletin/new`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 12; i++) {
  await sleep(120);
  const s = await page.evaluate(() => ({
    p: location.pathname,
    o: JSON.parse(localStorage.getItem("rc.profile") || "{}").ownerBusinessId,
    body: !!document.querySelector("#b-body"),
  }));
  console.log(`  t=${(i + 1) * 120}ms path=${s.p} ownerId=${s.o} hasForm=${s.body}`);
  if (s.body) break;
}
try {
  await page.waitForSelector("#b-body", { timeout: 4000 });
  await page.type("#b-body", "We're open! Come say hi.");
  await clickText(page, "Post now");
  await sleep(900);
  console.log(`after post bulletin: path=${await page.evaluate(() => location.pathname)}`);
} catch {
  console.log("could not reach bulletin form (#b-body)");
}
// Verify it persisted to the overlay + shows on the public profile
const overlay = await page.evaluate(() => JSON.parse(localStorage.getItem("rc.owner.v1") || "{}"));
console.log(`overlay: newBusinesses=${overlay.newBusinesses?.length} newBulletins=${overlay.newBulletins?.length}`);
const slug = overlay.newBusinesses?.[0]?.slug;
if (slug) {
  await page.goto(`${BASE}/b/${slug}`, { waitUntil: "networkidle0" });
  await sleep(400);
  const onProfile = await page.evaluate(() => ({
    name: document.body.innerText.includes("Test Roastery"),
    bulletin: document.body.innerText.includes("Come say hi"),
  }));
  console.log(`public profile: name=${onProfile.name} bulletinVisible=${onProfile.bulletin}`);
  await page.screenshot({ path: `${OUT}/s7-e2e-profile.png`, fullPage: true });
}

await browser.close();
