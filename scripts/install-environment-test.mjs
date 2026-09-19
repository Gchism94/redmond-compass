// Pure platform/browser classification checks for tailored PWA install guidance.
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const temp = mkdtempSync(path.join(tmpdir(), "rc-install-test-"));
const output = path.join(temp, "install-environment.mjs");
await build({
  entryPoints: [path.join(ROOT, "src/pwa/installEnvironment.ts")],
  bundle: true, platform: "node", format: "esm", outfile: output, logLevel: "error",
});
const { detectInstallEnvironment } = await import(output);

let pass = 0;
let fail = 0;
const ok = (condition, message) => {
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
  condition ? pass++ : fail++;
};

const iphoneSafari = detectInstallEnvironment({
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  platform: "iPhone",
  maxTouchPoints: 5,
});
ok(iphoneSafari.device === "iphone" && iphoneSafari.browser === "safari", "recognizes Safari on iPhone");

const iphoneChrome = detectInstallEnvironment({
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148 Safari/604.1",
  platform: "iPhone",
  maxTouchPoints: 5,
});
ok(iphoneChrome.platform === "ios" && iphoneChrome.browser === "chrome", "keeps Chrome on iPhone in the iOS install flow");

const ipadDesktopUa = detectInstallEnvironment({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
  platform: "MacIntel",
  maxTouchPoints: 5,
});
ok(ipadDesktopUa.device === "ipad" && ipadDesktopUa.isMobile, "recognizes iPadOS when it requests a desktop user agent");

const androidChrome = detectInstallEnvironment({
  userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
  platform: "Linux armv8l",
  maxTouchPoints: 5,
});
ok(androidChrome.device === "android" && androidChrome.browser === "chrome", "recognizes Chrome on Android");

const samsung = detectInstallEnvironment({
  userAgent: "Mozilla/5.0 (Linux; Android 15; SM-S928U) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 SamsungBrowser/27.0",
  platform: "Linux armv8l",
});
ok(samsung.platform === "android" && samsung.browser === "samsung", "recognizes Samsung Internet before its embedded Chrome token");

const desktop = detectInstallEnvironment({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
  platform: "MacIntel",
  maxTouchPoints: 0,
});
ok(desktop.device === "desktop" && !desktop.isMobile && desktop.browser === "chrome", "keeps a Mac desktop in the desktop flow");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
