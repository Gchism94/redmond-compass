// Outbound phone-link accuracy. Extensions must never be concatenated into a different
// subscriber number; malformed values must not create callable controls.
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(path.join(tmpdir(), "rc-links-"));
const outfile = path.join(tmp, "links.mjs");
await build({
  entryPoints: [path.join(ROOT, "src/lib/links.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "error",
  absWorkingDir: ROOT,
});

const { telHref } = await import(outfile);
let pass = 0;
let fail = 0;
const ok = (condition, message) => {
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
  condition ? pass++ : fail++;
};

ok(telHref("(541) 322-7500") === "tel:5413227500", "formats a standard local number");
ok(telHref("+1 (541) 322-7500") === "tel:+15413227500", "preserves an international + prefix");
ok(telHref("(541) 322-7500 x9") === "tel:5413227500;ext=9", "preserves an x-style extension");
ok(telHref("541-322-7500 ext. 123") === "tel:5413227500;ext=123", "preserves an ext.-style extension");
ok(telHref("541-322-7500 extension: 4") === "tel:5413227500;ext=4", "preserves a written extension");
ok(telHref("911") === "tel:911", "preserves a valid emergency service code");
ok(telHref("not listed") === undefined, "omits non-phone text");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
