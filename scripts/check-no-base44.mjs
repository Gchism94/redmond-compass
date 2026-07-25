// Acceptance gate (sheet-sync-spec §6): keep the old platform fully migrated OUT of anything
// that ships. Tiered so migration-context prose in developer docs stays legal while a real
// leak is still caught:
//
//   • User-facing artifacts — the built output (dist/) and the email templates that land in
//     inboxes (supabase/templates/*.html) — must contain ZERO `base44` token.
//   • Shipped source code — the edge functions (supabase/functions/**.{ts,js}) — must contain
//     no base44 URL (e.g. media.base44.com). The word "Base44" in a migration-explaining
//     comment is fine; a base44 CDN URL hardcoded in code is not.
//
// Developer docs (*.md, *.sql, config) are intentionally NOT scanned — they legitimately
// reference the Base44 export/migration, including example media.base44.com URLs.
//
// The dist/ tier needs a prior `npm run build` (+ `npm run prerender`); the source tiers run
// without a build. Usage: node scripts/check-no-base44.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const WORD_RE = /base44/i; //           any mention — for user-facing artifacts
const URL_RE = /base44\.[a-z]/i; //     a base44 domain (media.base44.com) — for shipped code

const TIERS = [
  { dir: "dist",               exts: /\.(js|css|html|json|webmanifest|xml|txt|svg)$/i, needle: WORD_RE, label: "dist/ (built output)",           optional: true },
  { dir: "supabase/templates", exts: /\.html$/i,                                       needle: WORD_RE, label: "supabase/templates/ (email HTML)", optional: false },
  { dir: "supabase/functions", exts: /\.(ts|js)$/i,                                    needle: URL_RE,  label: "supabase/functions/ (edge code)", optional: false },
];

const hits = [];
let scanned = 0;

function walk(dir, exts, needle) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, needle);
    else if (exts.test(entry)) {
      scanned++;
      const text = readFileSync(full, "utf8");
      const line = text.split("\n").find((l) => needle.test(l));
      if (line) hits.push(`${path.relative(ROOT, full)} :: ${line.trim().slice(0, 120)}`);
    }
  }
}

for (const t of TIERS) {
  const dir = path.join(ROOT, t.dir);
  let exists = true;
  try { statSync(dir); } catch { exists = false; }
  if (!exists) {
    if (t.optional) { console.log(`note: skipped ${t.label} — not present (run \`npm run build\` to include it)`); continue; }
    console.error(`FAIL  required scan root missing: ${t.dir}`);
    process.exit(1);
  }
  walk(dir, t.exts, t.needle);
}

if (hits.length) {
  console.log(`FAIL  base44 leak found (${hits.length}):`);
  for (const h of hits) console.log(`  - ${h}`);
  process.exit(1);
}
console.log(`PASS  no base44 leak — scanned ${scanned} file(s) (dist+templates: any mention · functions: URLs only).`);
