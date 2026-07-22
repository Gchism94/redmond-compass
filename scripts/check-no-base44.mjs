// Acceptance gate (sheet-sync-spec §6): the built output must contain zero
// references to `base44` — the old platform is fully migrated out. Run AFTER
// `npm run build` (and `npm run prerender`).  Usage: node scripts/check-no-base44.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DIST = path.resolve(import.meta.dirname, "..", "dist");
const NEEDLE = /base44/i;
const hits = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (/\.(js|css|html|json|webmanifest|xml|txt|svg)$/i.test(entry)) {
      const text = readFileSync(full, "utf8");
      if (NEEDLE.test(text)) {
        const line = text.split("\n").find((l) => NEEDLE.test(l))?.trim().slice(0, 120);
        hits.push(`${path.relative(DIST, full)} :: ${line}`);
      }
    }
  }
}

try {
  walk(DIST);
} catch {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

if (hits.length) {
  console.log(`FAIL  base44 found in built output (${hits.length}):`);
  for (const h of hits) console.log(`  - ${h}`);
  process.exit(1);
}
console.log("PASS  no `base44` in built output (dist/)");
