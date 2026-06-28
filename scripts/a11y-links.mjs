// Find <a> elements with no accessible name (link-text offenders) across routes.
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.argv[2] || "http://localhost:4173";
const ROUTES = ["/", "/search", "/events", "/community", "/resources", "/b/juniper-and-sage-cafe"];
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const r of ROUTES) {
  await page.goto(`${BASE}${r}`, { waitUntil: "networkidle0" });
  await new Promise((res) => setTimeout(res, 600));
  const bad = await page.evaluate(() =>
    [...document.querySelectorAll("a")]
      .filter((a) => {
        const name = (a.getAttribute("aria-label") || a.textContent || a.querySelector("img")?.alt || "").trim();
        return a.offsetParent !== null && name === "";
      })
      .map((a) => a.outerHTML.slice(0, 110)),
  );
  console.log(`${r}: ${bad.length} empty-name link(s)`);
  bad.forEach((s) => console.log("   ", s.replace(/\s+/g, " ")));
}
await b.close();
