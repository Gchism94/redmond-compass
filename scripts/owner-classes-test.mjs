// Owner classes/workshops flow — real screens + real query/mutation hooks over the mock
// DataSource. Exercises create, edit, cancel, restore, delete, and Spanish UI copy.
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4482;
const BASE = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (condition, message) => {
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
  condition ? pass++ : fail++;
};

const tmp = mkdtempSync(path.join(tmpdir(), "rc-owner-classes-"));
const entry = path.join(tmp, "entry.tsx");
writeFileSync(entry, `
import { createRoot } from "react-dom/client";
import { createElement as h } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { DataProvider } from "@/data/DataProvider";
import { MockDataSource } from "@/data/mock/MockDataSource";
import { SessionProvider } from "@/features/account/session";
import { ManageClassesScreen, ClassEditorScreen } from "@/features/owner/ManageClassesScreen";

localStorage.setItem("rc.profile", JSON.stringify({ ownerBusinessId: "b_juniper", onboarded: true }));
const source = new MockDataSource();
window.__source = source;
createRoot(document.getElementById("root")).render(
  h(I18nProvider, null,
    h(DataProvider, { source },
      h(SessionProvider, null,
        h(MemoryRouter, { initialEntries: ["/manage/classes"] },
          h(Routes, null,
            h(Route, { path: "/manage/classes", element: h(ManageClassesScreen) }),
            h(Route, { path: "/manage/classes/new", element: h(ClassEditorScreen) }),
            h(Route, { path: "/manage/classes/:id/edit", element: h(ClassEditorScreen) }),
            h(Route, { path: "/b/:slug", element: h("p", null, "Public profile") })
          )
        )
      )
    )
  )
);
`);

const outdir = path.join(tmp, "site");
const testConfig = path.join(tmp, "compass.config.ts");
writeFileSync(testConfig, `export const compassConfig = { siteMode: "full-site", liveSite: "https://redmondcompass.com", appOrigin: "http://localhost:${PORT}" };`);
await build({
  entryPoints: [entry], bundle: true, format: "esm", platform: "browser",
  outfile: path.join(outdir, "app.js"), logLevel: "error", jsx: "automatic",
  absWorkingDir: ROOT, nodePaths: [path.join(ROOT, "node_modules")],
  alias: { "@": path.join(ROOT, "src"), "@config": testConfig },
  loader: { ".css": "empty" },
  define: {
    "import.meta.env.DEV": "false", "import.meta.env.PROD": "true",
    "import.meta.env.VITE_DATA_SOURCE": '"mock"',
    "import.meta.env.VITE_SUPABASE_URL": '""', "import.meta.env.VITE_SUPABASE_ANON_KEY": '""',
    "process.env.NODE_ENV": '"production"',
  },
});
writeFileSync(path.join(outdir, "index.html"),
  '<!doctype html><html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
const server = spawn("npx", ["--yes", "http-server", outdir, "-p", String(PORT), "-s"], { stdio: "ignore" });
for (let i = 0; ; i++) {
  try { await fetch(BASE); break; } catch {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (i > 60) { server.kill(); throw new Error("harness did not start"); }
  }
}
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle0" });
await new Promise((resolve) => setTimeout(resolve, 700));
const text = () => page.evaluate(() => document.body.innerText);

let body = await text();
ok(/Latte Art Workshop/.test(body) && /Sourdough Basics/.test(body),
   "management view includes upcoming and past class history");
ok(/Add class/.test(body) && /Upcoming & cancelled/.test(body),
   "management view has a clear create action and current grouping");

await page.click('a[href="/manage/classes/new"]');
await page.waitForSelector("#class-title");
await page.type("#class-title", "Compass Test Workshop");
await page.type("#class-date", "09/12/2099");
await page.type("#class-time", "6–8 PM");
await page.type("#class-location", "Community room");
await page.type("#class-link", "example.com/register");
await page.select("#class-status", "waitlist");
await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => /Create class/.test(button.textContent))?.click());
await page.waitForFunction(() => document.body.innerText.includes("Compass Test Workshop"));
body = await text();
ok(/Compass Test Workshop/.test(body) && /Waitlist/.test(body),
   "create returns to the manager with the new availability visible");

const storedLink = await page.evaluate(() => {
  const overlay = JSON.parse(localStorage.getItem("rc.owner.v1") || "{}");
  return overlay.newBusinessClasses?.find((item) => item.title === "Compass Test Workshop")?.link;
});
ok(storedLink === "https://example.com/register", `booking links are normalized safely (${storedLink})`);

const cardAction = async (cardTitle, label) => page.evaluate(({ cardTitle, label }) => {
  const heading = [...document.querySelectorAll("h3")].find((node) => node.textContent?.includes(cardTitle));
  const card = heading?.closest("article, div[class*='rounded']") || heading?.parentElement?.parentElement?.parentElement;
  const action = [...(card?.querySelectorAll("a,button") || [])].find((node) => node.textContent?.includes(label));
  action?.click();
  return !!action;
}, { cardTitle, label });

ok(await cardAction("Compass Test Workshop", "Edit"), "the new class exposes an edit action");
await page.waitForSelector("#class-title");
await page.click("#class-title", { clickCount: 3 });
await page.keyboard.press("Backspace");
await page.type("#class-title", "Updated Compass Workshop");
await page.select("#class-status", "sold_out");
await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => /Save changes/.test(button.textContent))?.click());
await page.waitForFunction(() => document.body.innerText.includes("Updated Compass Workshop"));
body = await text();
ok(/Updated Compass Workshop/.test(body) && /Sold out/.test(body), "edit persists title and availability changes");

ok(await cardAction("Updated Compass Workshop", "Cancel class"), "the owner can cancel without deleting history");
await page.waitForFunction(() => document.body.innerText.includes("Cancelled"));
body = await text();
ok(/Updated Compass Workshop/.test(body) && /Cancelled/.test(body), "cancelled class remains in owner history");
ok(await cardAction("Updated Compass Workshop", "Restore as open"), "a cancelled class can be restored");
await page.waitForFunction(() => document.body.innerText.includes("Restore as open") === false);

ok(await cardAction("Updated Compass Workshop", "Delete permanently"), "delete requires an inline confirmation");
await page.waitForFunction(() => document.body.innerText.includes("This cannot be undone"));
ok(await cardAction("Updated Compass Workshop", "Delete permanently"), "the confirmed permanent delete is available");
await page.waitForFunction(() => !document.body.innerText.includes("Updated Compass Workshop"));
ok(!(await text()).includes("Updated Compass Workshop"), "confirmed deletion removes the class");

await page.evaluate(() => localStorage.setItem("rc.lang", "es"));
await page.reload({ waitUntil: "networkidle0" });
await new Promise((resolve) => setTimeout(resolve, 700));
body = await text();
ok(/Clases y talleres/.test(body) && /Agregar clase/.test(body) && /Clases anteriores/.test(body),
   "owner class management chrome is translated into Spanish");
await page.evaluate(() => [...document.querySelectorAll('a')].find((link) => /Agregar clase/.test(link.textContent))?.click());
await page.waitForSelector("#class-title");
body = await text();
ok(/obligatorio/.test(body) && !/\brequired\b/i.test(body),
   "required-field labels are translated on the Spanish class form");

await browser.close();
server.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
