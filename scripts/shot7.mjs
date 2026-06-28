// Step-7 screenshots: owner path (dashboard, edit, bulletin under/over cap, event, claim).
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.argv[2] || ".";
const BASE = "http://localhost:5173";

const baseProfile = (over) => ({
  onboarded: true,
  savedBusinessIds: [], followedBusinessIds: [], savedEventIds: [], recentlyViewedIds: [],
  interests: [], location: null,
  notificationPrefs: { followedBulletins: true, savedEvents: true, localNews: false },
  ownerBusinessId: over,
});
const USER = { id: "u_demo", email: "dana@example.com", name: "Dana" };
// 3 overlay bulletins this month for b_juniper → pushes over the free cap of 3.
const OVER_CAP_OVERLAY = {
  newBusinesses: [], patches: {}, newEvents: [],
  newBulletins: [
    { id: "bl_o1", businessId: "b_juniper", body: "Extra 1", status: "live", createdAt: "2026-06-26T09:00:00" },
    { id: "bl_o2", businessId: "b_juniper", body: "Extra 2", status: "live", createdAt: "2026-06-26T10:00:00" },
    { id: "bl_o3", businessId: "b_juniper", body: "Extra 3", status: "live", createdAt: "2026-06-27T09:00:00" },
  ],
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--hide-scrollbars"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(path, file, { profile, user, overlay, full = true } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument((p, u, o) => {
    if (p) localStorage.setItem("rc.profile", JSON.stringify(p));
    if (u) localStorage.setItem("rc.user", JSON.stringify(u));
    if (o) localStorage.setItem("rc.owner.v1", JSON.stringify(o));
  }, profile, user, overlay);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(500);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: full });
  console.log(`${path} → ${file}  overflowX=${overflowX}`);
  await page.close();
}

await shot("/manage", "s7-dashboard.png", { profile: baseProfile("b_juniper"), user: USER });
await shot("/manage/edit", "s7-edit.png", { profile: baseProfile("b_juniper"), user: USER });
await shot("/manage/bulletin/new", "s7-bulletin.png", { profile: baseProfile("b_basalt"), user: USER });
await shot("/manage/bulletin/new", "s7-bulletin-overcap.png", { profile: baseProfile("b_juniper"), user: USER, overlay: OVER_CAP_OVERLAY });
await shot("/manage/event/new", "s7-event.png", { profile: baseProfile("b_juniper"), user: USER });
await shot("/claim", "s7-claim.png", { profile: baseProfile(null) });

await browser.close();
