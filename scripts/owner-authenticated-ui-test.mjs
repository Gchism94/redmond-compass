// Authenticated owner-route smoke using the real session, claim, dashboard, and manager
// screens against the mock DataSource. This closes the gap between isolated form tests and
// the production-safe public smoke, which cannot carry a real owner's credentials.
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4491;
const BASE = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (condition, message) => {
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
  condition ? pass++ : fail++;
};

const temp = mkdtempSync(path.join(tmpdir(), "rc-owner-authenticated-"));
const entry = path.join(temp, "entry.tsx");
writeFileSync(entry, `
import { createRoot } from "react-dom/client";
import { createElement as h } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { DataProvider } from "@/data/DataProvider";
import { SessionProvider } from "@/features/account/session";
import { MockDataSource } from "@/data/mock/MockDataSource";
import { LoginScreen } from "@/features/account/LoginScreen";
import { AccountScreen } from "@/features/account/AccountScreen";
import { ClaimScreen } from "@/features/owner/ClaimScreen";
import { OwnerDashboard } from "@/features/owner/OwnerDashboard";
import { EditListingScreen } from "@/features/owner/EditListingScreen";
import { ManageBulletinsScreen } from "@/features/owner/ManageBulletinsScreen";
import { ManageEventsScreen } from "@/features/owner/ManageEventsScreen";
import { ManageClassesScreen } from "@/features/owner/ManageClassesScreen";

localStorage.clear();
const source = new MockDataSource();
createRoot(document.getElementById("root")).render(
  h(I18nProvider, null,
    h(DataProvider, { source },
      h(SessionProvider, null,
        h(MemoryRouter, { initialEntries: ["/login"] },
          h(Routes, null,
            h(Route, { path: "/login", element: h(LoginScreen) }),
            h(Route, { path: "/account", element: h(AccountScreen) }),
            h(Route, { path: "/claim", element: h(ClaimScreen) }),
            h(Route, { path: "/manage", element: h(OwnerDashboard) }),
            h(Route, { path: "/manage/edit", element: h(EditListingScreen) }),
            h(Route, { path: "/manage/bulletins", element: h(ManageBulletinsScreen) }),
            h(Route, { path: "/manage/events", element: h(ManageEventsScreen) }),
            h(Route, { path: "/manage/classes", element: h(ManageClassesScreen) }),
            h(Route, { path: "*", element: h("div", null, "TEST-NOT-FOUND") })
          )
        )
      )
    )
  )
);
`);

const outdir = path.join(temp, "site");
await build({
  entryPoints: [entry], bundle: true, format: "esm", platform: "browser",
  outfile: path.join(outdir, "app.js"), logLevel: "error", jsx: "automatic",
  absWorkingDir: ROOT, nodePaths: [path.join(ROOT, "node_modules")],
  alias: { "@": path.join(ROOT, "src"), "@config": path.join(ROOT, "compass.config.ts") },
  loader: { ".css": "empty" },
  define: {
    "import.meta.env.DEV": "false", "import.meta.env.PROD": "false",
    "import.meta.env.VITE_DATA_SOURCE": '"mock"',
    "import.meta.env.VITE_SUPABASE_URL": '""', "import.meta.env.VITE_SUPABASE_ANON_KEY": '""',
    "process.env.NODE_ENV": '"production"',
  },
});
writeFileSync(path.join(outdir, "index.html"),
  '<!doctype html><html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');

const server = createServer((request, response) => {
  const script = request.url === "/app.js";
  response.writeHead(200, { "Content-Type": script ? "text/javascript" : "text/html" });
  response.end(readFileSync(path.join(outdir, script ? "app.js" : "index.html")));
});
await new Promise((resolve, reject) => server.listen(PORT, "127.0.0.1", resolve).once("error", reject));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(BASE, { waitUntil: "networkidle0" });

const clickText = async (text) => page.evaluate((label) => {
  const element = [...document.querySelectorAll("button, a")]
    .find((candidate) => candidate.textContent?.trim().includes(label));
  element?.click();
  return !!element;
}, text);
const body = () => page.evaluate(() => document.body.innerText);
const waitForText = (text) => page.waitForFunction((value) => document.body.innerText.includes(value), {}, text);

await page.type('input[type="email"]', "owner@example.test");
await page.type('input[autocomplete="name"]', "Owner Test");
await page.$eval("form", (form) => form.requestSubmit());
await waitForText("Switch to Business");
ok((await body()).includes("Signed in"), "real session UI completes mock email sign-in");

await clickText("Switch to Business");
await waitForText("List your business");
await page.type('input[aria-label="Search by name or address"]', "Mountain View");
await waitForText("Mountain View Auto Repair");
await clickText("Claim");
await waitForText("Dashboard");
let text = await body();
ok(text.includes("Mountain View Auto Repair"), "authenticated owner reaches the claimed listing dashboard");
ok(text.includes("Listing details come from redmondcompass.com"), "dashboard explains the authoritative main-site record");
const sourceLink = await page.$eval('a[href="https://redmondcompass.com/dashboard"]', (link) => ({
  target: link.target, rel: link.rel,
}));
ok(sourceLink.target === "_blank" && sourceLink.rel.includes("noopener"), "main-site dashboard handoff is safe and explicit");

for (const [action, expected] of [["Bulletins", "No bulletins yet"], ["Events", "No events yet"], ["Classes & workshops", "No classes listed yet"]]) {
  await clickText(action);
  await waitForText(expected);
  ok(!(await body()).includes("TEST-NOT-FOUND"), `${action} authenticated manager route renders`);
  await page.click('button[aria-label="Back"]');
  await waitForText("Dashboard");
}

await clickText("Edit listing");
await waitForText("Update your main listing");
text = await body();
ok(text.includes("within six hours") && text.includes("Current app details"), "edit route hands canonical fields to the source workflow");
ok((await page.$$('input:not([type="hidden"])')).length === 0, "app-only edit route cannot create a conflicting canonical edit");
ok((await page.$eval('textarea[readonly]', (area) => area.value)).includes("Mountain View Auto Repair"), "handoff includes a copyable app-data packet");

ok(errors.length === 0, `authenticated owner journey has zero page errors (${errors.join(" | ") || "clean"})`);
await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
