// Step-6b screenshots: events list (toggle), calendar view, detail menu, saved events bulk.
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.argv[2] || ".";
const BASE = "http://localhost:5173";

const ONBOARDED = { onboarded: true, savedBusinessIds: [], followedBusinessIds: [], savedEventIds: [], recentlyViewedIds: [], interests: [], location: null, notificationPrefs: { followedBulletins: true, savedEvents: true, localNews: false } };
const SAVED = { ...ONBOARDED, savedEventIds: ["e_1", "e_2", "e_4"] };
const USER = { id: "u_demo", email: "dana@example.com", name: "Dana" };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--hide-scrollbars"] });

async function newPage(profile, user) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument((p, u) => {
    localStorage.setItem("rc.profile", JSON.stringify(p));
    if (u) localStorage.setItem("rc.user", JSON.stringify(u));
  }, profile, user);
  return page;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const clickByText = (page, text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === t || b.textContent?.trim().startsWith(t));
    el?.click();
    return !!el;
  }, text);

// Events: list (default) then calendar
{
  const page = await newPage(ONBOARDED);
  await page.goto(`${BASE}/events`, { waitUntil: "networkidle0" });
  await sleep(400);
  await page.screenshot({ path: `${OUT}/s6b-events-list.png`, fullPage: true });
  console.log(`events list  overflowX=${await overflow(page)}`);
  const clicked = await clickByText(page, "Calendar");
  await sleep(500);
  await page.screenshot({ path: `${OUT}/s6b-events-calendar.png`, fullPage: false });
  console.log(`events calendar (toggled=${clicked})  overflowX=${await overflow(page)}`);
  await page.close();
}

// Event detail + open Add-to-calendar menu
{
  const page = await newPage(ONBOARDED);
  await page.goto(`${BASE}/events/e_1`, { waitUntil: "networkidle0" });
  await sleep(400);
  const clicked = await clickByText(page, "Add to calendar");
  await sleep(400);
  const menu = await page.$('[role="menu"]');
  await page.screenshot({ path: `${OUT}/s6b-detail-menu.png`, fullPage: false });
  console.log(`detail menu (btn=${clicked}, menuPresent=${!!menu})  overflowX=${await overflow(page)}`);
  await page.close();
}

// Saved → Events (bulk button + per-card calendar)
{
  const page = await newPage(SAVED, USER);
  await page.goto(`${BASE}/saved`, { waitUntil: "networkidle0" });
  await sleep(400);
  await clickByText(page, "Events");
  await sleep(400);
  await page.screenshot({ path: `${OUT}/s6b-saved-events.png`, fullPage: true });
  console.log(`saved events  overflowX=${await overflow(page)}`);
  await page.close();
}

await browser.close();
