// Step-6 screenshots: onboarding, JIT auth, and seeded personalized states.
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.argv[2] || ".";
const BASE = "http://localhost:5173";

const SEED_PROFILE = {
  savedBusinessIds: ["b_juniper", "b_highdesert"],
  followedBusinessIds: ["b_basalt", "b_smithrock"],
  savedEventIds: ["e_2"],
  recentlyViewedIds: ["b_dailygrind", "b_cascade", "b_threesisters"],
  interests: ["Food & Drink", "Outdoors", "Live music"],
  location: null,
  notificationPrefs: { followedBulletins: true, savedEvents: true, localNews: false },
  onboarded: true,
};
const SEED_USER = { id: "u_demo", email: "dana@example.com", name: "Dana" };

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars"],
});

async function newPage(seed) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (seed) {
    await page.evaluateOnNewDocument((s) => {
      localStorage.setItem("rc.profile", JSON.stringify(s.profile));
      if (s.user) localStorage.setItem("rc.user", JSON.stringify(s.user));
    }, seed);
  }
  return page;
}

async function shot(page, path, file, full = true) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));
  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: full });
  console.log(`${path} → ${file}  overflowX=${overflowX}`);
}

// 1) Onboarding — fresh (no seed), first launch
{
  const page = await newPage(null);
  await shot(page, "/", "s6-onboarding.png");
  await page.close();
}

// 2) JIT auth sheet — guest (onboarded, no user), tap Save on a profile
{
  const page = await newPage({ profile: { ...SEED_PROFILE, savedBusinessIds: [], followedBusinessIds: [] } });
  await page.goto(`${BASE}/b/juniper-and-sage-cafe`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Save" && b.getAttribute("aria-pressed") !== null,
    );
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const dialog = await page.$('[role="dialog"]');
  await page.screenshot({ path: `${OUT}/s6-authsheet.png`, fullPage: false });
  console.log(`/b/... + tap Save → s6-authsheet.png  dialogPresent=${!!dialog}`);
  await page.close();
}

// 3) Account (signed in, seeded)
{
  const page = await newPage({ profile: SEED_PROFILE, user: SEED_USER });
  await shot(page, "/account", "s6-account.png");
  await page.close();
}

// 4) Saved (has items)
{
  const page = await newPage({ profile: SEED_PROFILE, user: SEED_USER });
  await shot(page, "/saved", "s6-saved.png");
  await page.close();
}

// 5) Home — personalized (follow feed + recently viewed)
{
  const page = await newPage({ profile: SEED_PROFILE, user: SEED_USER });
  await shot(page, "/", "s6-home-personalized.png");
  await page.close();
}

await browser.close();
