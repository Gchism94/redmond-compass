// Authentication UI resilience regression test (audit 2026-08-26).
//
// A hosted SMTP failure returned an AuthApiError whose message was literally "{}". Both
// sign-in surfaces rendered that raw value to residents. This mounts the real LoginScreen
// and AuthSheet against an injected auth source and proves provider internals stay hidden,
// the error is accessible, translations hold, and incomplete OTPs never reach the server.
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4483;
const BASE = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

const tmp = mkdtempSync(path.join(tmpdir(), "rc-auth-ui-"));
const entry = path.join(tmp, "entry.tsx");
writeFileSync(entry, `
import { createRoot } from "react-dom/client";
import { createElement as h, useEffect } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { DataProvider } from "@/data/DataProvider";
import { SessionProvider, useSession } from "@/features/account/session";
import { LoginScreen } from "@/features/account/LoginScreen";
import { AuthSheet } from "@/features/account/AuthSheet";
import { MockDataSource } from "@/data/mock/MockDataSource";

const q = new URLSearchParams(location.search);
localStorage.setItem("rc.lang", q.get("lang") ?? "en");
window.__verifyCalls = 0;

function source() {
  const base = new MockDataSource();
  return new Proxy(base, {
    get(t, prop, r) {
      if (prop === "startEmailAuth") return async () => {
        if (q.get("mode") === "fail") {
          throw Object.assign(new Error("{}"), { status: 500, code: "unexpected_failure" });
        }
        return { otpSent: true };
      };
      if (prop === "verifyEmailOtp") return async () => {
        window.__verifyCalls++;
        throw new Error("server should not receive an incomplete OTP");
      };
      if (prop === "getAuthUser") return async () => null;
      if (prop === "onAuthChange") return () => () => {};
      const v = Reflect.get(t, prop, r);
      return typeof v === "function" ? v.bind(t) : v;
    },
  });
}

function SheetHarness() {
  const s = useSession();
  useEffect(() => s.openAuth("account"), [s.openAuth]);
  return h(AuthSheet);
}

const Screen = q.get("surface") === "sheet" ? SheetHarness : LoginScreen;
createRoot(document.getElementById("root")).render(
  h(I18nProvider, null,
    h(DataProvider, { source: source() },
      h(SessionProvider, null,
        h(MemoryRouter, { initialEntries: ["/login"] },
          h(Routes, null, h(Route, { path: "*", element: h(Screen) })))))),
);
`);

const outdir = path.join(tmp, "site");
await build({
  entryPoints: [entry], bundle: true, format: "esm", platform: "browser",
  outfile: path.join(outdir, "app.js"), logLevel: "error", jsx: "automatic",
  absWorkingDir: ROOT, nodePaths: [path.join(ROOT, "node_modules")],
  alias: { "@": path.join(ROOT, "src"), "@config": path.join(ROOT, "compass.config.ts") },
  loader: { ".css": "empty" },
  define: {
    "import.meta.env.DEV": "false", "import.meta.env.PROD": "true",
    "import.meta.env.VITE_DATA_SOURCE": '"mock"',
    "import.meta.env.VITE_SUPABASE_URL": '""', "import.meta.env.VITE_SUPABASE_ANON_KEY": '""',
    "process.env.NODE_ENV": '"production"',
  },
});
writeFileSync(path.join(outdir, "index.html"),
  `<!doctype html><html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`);

const server = spawn("npx", ["--yes", "http-server", outdir, "-p", String(PORT), "-s"], { stdio: "ignore" });
for (let i = 0; ; i++) {
  try { await fetch(BASE); break } catch {
    await new Promise((r) => setTimeout(r, 300));
    if (i > 60) { server.kill(); throw new Error("harness did not start"); }
  }
}
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

async function submit(surface, mode, lang = "en") {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(`${BASE}/?${new URLSearchParams({ surface, mode, lang })}`, { waitUntil: "networkidle0" });
  await page.type('input[type="email"]', "resident@example.com");
  await page.$eval("form", (f) => f.requestSubmit());
  await new Promise((r) => setTimeout(r, 250));
  if (mode === "otp") {
    await page.type('input[autocomplete="one-time-code"]', "123");
    await page.$eval("form", (f) => f.requestSubmit());
    await new Promise((r) => setTimeout(r, 100));
  }
  const result = await page.evaluate(() => ({
    text: document.body.innerText,
    alerts: document.querySelectorAll('[role="alert"]').length,
    verifyCalls: window.__verifyCalls,
    rawBraces: document.body.innerText.split("\n").some((x) => x.trim() === "{}"),
  }));
  await page.close();
  return result;
}

for (const surface of ["login", "sheet"]) {
  const failed = await submit(surface, "fail");
  ok(/Couldn't send your code/.test(failed.text), `[${surface}] hosted auth failure gets useful copy`);
  ok(!failed.rawBraces, `[${surface}] raw provider braces are not rendered`);
  ok(failed.alerts === 1, `[${surface}] auth failure is announced as an alert (${failed.alerts})`);

  const short = await submit(surface, "otp");
  ok(/Enter the 6-digit code/.test(short.text), `[${surface}] incomplete OTP gets client guidance`);
  ok(short.verifyCalls === 0, `[${surface}] incomplete OTP never reaches the server (${short.verifyCalls})`);
}

const spanish = await submit("login", "fail", "es");
ok(/No pudimos enviar tu código/.test(spanish.text), "auth fallback is translated to Spanish");
ok(!spanish.rawBraces, "Spanish auth failure hides raw provider braces too");

await browser.close();
server.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
