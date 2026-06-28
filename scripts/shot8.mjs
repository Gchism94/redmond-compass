// Step-8 screenshots: install banner (iOS hint), offline banner, Account install row.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.argv[2] || ".";
const BASE = "http://localhost:5173";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ONBOARDED = {
  onboarded: true, savedBusinessIds: [], followedBusinessIds: [], savedEventIds: [],
  recentlyViewedIds: [], interests: [], location: null,
  notificationPrefs: { followedBulletins: true, savedEvents: true, localNews: false }, ownerBusinessId: null,
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--hide-scrollbars"] });

async function newPage(ua) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (ua) await page.setUserAgent(ua);
  await page.evaluateOnNewDocument((p) => {
    if (!localStorage.getItem("rc.profile")) localStorage.setItem("rc.profile", JSON.stringify(p));
  }, ONBOARDED);
  return page;
}

// 1) Home with iOS UA → install banner (Add to Home Screen hint)
{
  const page = await newPage(IOS_UA);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await sleep(500);
  const banner = await page.evaluate(() => document.body.innerText.includes("Get the app"));
  console.log(`home iOS install banner present=${banner}`);
  await page.screenshot({ path: `${OUT}/s8-install-ios.png`, fullPage: false });
  await page.close();
}

// 2) Home → go offline → offline banner
{
  const page = await newPage(null);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await sleep(400);
  await page.setOfflineMode(true);
  await sleep(400);
  const off = await page.evaluate(() => document.body.innerText.includes("offline"));
  console.log(`offline banner present=${off}`);
  await page.screenshot({ path: `${OUT}/s8-offline.png`, fullPage: false });
  await page.setOfflineMode(false);
  await page.close();
}

// 3) Account with iOS UA → install row
{
  const page = await newPage(IOS_UA);
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
  await sleep(400);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`account overflowX=${overflowX}`);
  await page.screenshot({ path: `${OUT}/s8-account-install.png`, fullPage: true });
  await page.close();
}

await browser.close();
