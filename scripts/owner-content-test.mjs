// Owner bulletins/events flow over the real screens and mock DataSource.
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4484;
const BASE = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (condition, message) => { console.log(`${condition ? "PASS" : "FAIL"}  ${message}`); condition ? pass++ : fail++; };

const tmp = mkdtempSync(path.join(tmpdir(), "rc-owner-content-"));
const entry = path.join(tmp, "entry.tsx");
writeFileSync(entry, `
import { createRoot } from "react-dom/client";
import { createElement as h } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { DataProvider } from "@/data/DataProvider";
import { MockDataSource } from "@/data/mock/MockDataSource";
import { SessionProvider } from "@/features/account/session";
import { ManageBulletinsScreen, BulletinEditorScreen } from "@/features/owner/ManageBulletinsScreen";
import { ManageEventsScreen, EventEditorScreen } from "@/features/owner/ManageEventsScreen";

localStorage.setItem("rc.profile", JSON.stringify({ ownerBusinessId: "b_juniper", onboarded: true }));
localStorage.setItem("rc.owner.v1", JSON.stringify({
  newEvents: [{ id: "e_sync_test", businessId: "b_juniper", title: "Calendar Sync Example", startAt: "2099-10-12T19:00:00", status: "upcoming", approvalStatus: "approved", gcalEventId: "gcal-read-only" }]
}));
const source = new MockDataSource();
window.__source = source;
const startRoute = new URLSearchParams(location.search).get("screen") === "events" ? "/manage/events" : "/manage/bulletins";
createRoot(document.getElementById("root")).render(
  h(I18nProvider, null, h(DataProvider, { source }, h(SessionProvider, null,
    h(MemoryRouter, { initialEntries: [startRoute] }, h(Routes, null,
      h(Route, { path: "/manage/bulletins", element: h(ManageBulletinsScreen) }),
      h(Route, { path: "/manage/bulletin/new", element: h(BulletinEditorScreen) }),
      h(Route, { path: "/manage/bulletins/:id/edit", element: h(BulletinEditorScreen) }),
      h(Route, { path: "/manage/events", element: h(ManageEventsScreen) }),
      h(Route, { path: "/manage/event/new", element: h(EventEditorScreen) }),
      h(Route, { path: "/manage/events/:id/edit", element: h(EventEditorScreen) }),
      h(Route, { path: "/b/:slug", element: h("p", null, "Public profile") })
    ))
  )))
);
`);

const outdir = path.join(tmp, "site");
const testConfig = path.join(tmp, "compass.config.ts");
writeFileSync(testConfig, `export const compassConfig = { siteMode: "full-site", liveSite: "https://redmondcompass.com", appOrigin: "http://localhost:${PORT}" };`);
await build({
  entryPoints: [entry], bundle: true, format: "esm", platform: "browser", outfile: path.join(outdir, "app.js"),
  logLevel: "error", jsx: "automatic", absWorkingDir: ROOT, nodePaths: [path.join(ROOT, "node_modules")],
  alias: { "@": path.join(ROOT, "src"), "@config": testConfig }, loader: { ".css": "empty" },
  define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true", "import.meta.env.VITE_DATA_SOURCE": '"mock"', "import.meta.env.VITE_SUPABASE_URL": '""', "import.meta.env.VITE_SUPABASE_ANON_KEY": '""', "process.env.NODE_ENV": '"production"' },
});
writeFileSync(path.join(outdir, "index.html"), '<!doctype html><html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
const server = spawn("npx", ["--yes", "http-server", outdir, "-p", String(PORT), "-s"], { stdio: "ignore" });
for (let i = 0; ; i++) { try { await fetch(BASE); break; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); if (i > 60) { server.kill(); throw new Error("harness did not start"); } } }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.goto(BASE, { waitUntil: "networkidle0" });
await new Promise((resolve) => setTimeout(resolve, 600));
const text = () => page.evaluate(() => document.body.innerText);
const clickText = async (label) => page.evaluate((label) => {
  const node = [...document.querySelectorAll("a,button")].find((item) => item.textContent?.includes(label));
  node?.click();
  return !!node;
}, label);
const clickInCard = async (cardText, label) => page.evaluate(({ cardText, label }) => {
  const marker = [...document.querySelectorAll("h3,p")].find((node) => node.textContent?.includes(cardText));
  let card = marker;
  while (card && !(card.classList.contains("p-4") && card.classList.contains("rounded-lg"))) card = card.parentElement;
  const action = [...(card?.querySelectorAll("a,button") || [])].find((node) => node.textContent?.includes(label));
  action?.click();
  return !!action;
}, { cardText, label });

let body = await text();
ok(/Fresh sourdough/.test(body) && /Post a bulletin/.test(body), "bulletin manager shows history and a clear create action");
await clickText("Post a bulletin");
await page.waitForSelector("#b-body");
await page.type("#b-body", "Compass owner bulletin test");
await page.type("#b-ll", "Details");
await page.type("#b-lu", "example.com/news");
await clickText("Post now");
await page.waitForFunction(() => document.body.innerText.includes("Compass owner bulletin test"));
const bulletinLink = await page.evaluate(() => JSON.parse(localStorage.getItem("rc.owner.v1") || "{}").newBulletins?.find((item) => item.body.includes("Compass owner"))?.linkCta?.url);
ok(bulletinLink === "https://example.com/news", `bulletin CTA is normalized safely (${bulletinLink})`);
ok(await clickInCard("Compass owner bulletin test", "Archive"), "a live bulletin can be archived without deleting its history");
await page.waitForFunction(() => document.body.innerText.includes("Restore live"));
ok(await clickInCard("Compass owner bulletin test", "Restore live"), "an archived bulletin can be restored live");
await page.waitForFunction(() => !document.body.innerText.includes("Restore live"));
ok(await clickInCard("Compass owner bulletin test", "Edit"), "bulletin exposes an edit action");
await page.waitForSelector("#b-body");
await page.click("#b-body", { clickCount: 3 }); await page.keyboard.press("Backspace"); await page.type("#b-body", "Updated owner bulletin test");
await clickText("Save changes");
await page.waitForFunction(() => document.body.innerText.includes("Updated owner bulletin test"));
ok((await text()).includes("Updated owner bulletin test"), "bulletin edits persist and return to history");

await page.goto(`${BASE}/?screen=events`, { waitUntil: "networkidle0" });
await new Promise((resolve) => setTimeout(resolve, 600));
body = await text();
ok(/Calendar Sync Example/.test(body) && /Calendar managed/.test(body), "calendar-synced events are identified as read-only");
ok(!await clickInCard("Calendar Sync Example", "Edit"), "calendar-synced events expose no edit action");
await clickText("Add event");
await page.waitForSelector("#ev-title");
await page.type("#ev-title", "Compass owner event test");
await page.type("#ev-date", "10/12/2099");
await page.type("#ev-start", "07:00PM");
await page.type("#ev-end", "09:00PM");
await clickText("Submit event");
await page.waitForFunction(() => document.body.innerText.includes("Compass owner event test"));
ok(await clickInCard("Compass owner event test", "Edit"), "app-authored event exposes an edit action");
await page.waitForSelector("#ev-title");
await page.click("#ev-title", { clickCount: 3 }); await page.keyboard.press("Backspace"); await page.type("#ev-title", "Updated owner event test");
await clickText("Save changes");
await page.waitForFunction(() => document.body.innerText.includes("Updated owner event test"));
ok(await clickInCard("Updated owner event test", "Cancel event"), "owner can cancel an event while retaining history");
await page.waitForFunction(() => document.body.innerText.includes("Restore event"));
const publicItems = await page.evaluate(async () => (await window.__source.listEvents()).map((item) => item.title));
ok(!publicItems.includes("Updated owner event test"), "cancelled event is removed from the public event list");
ok(await clickInCard("Updated owner event test", "Restore event"), "cancelled event can be restored");

await page.evaluate(() => localStorage.setItem("rc.lang", "es"));
await page.reload({ waitUntil: "networkidle0" });
await new Promise((resolve) => setTimeout(resolve, 600));
body = await text();
ok(/Eventos/.test(body) && /Agregar evento/.test(body) && /Administrado por calendario/.test(body), "owner event management is translated into Spanish");

await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
