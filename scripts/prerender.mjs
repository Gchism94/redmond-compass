// Prerender the content pages (guides) to static HTML + generate sitemap.xml.
// Run AFTER `npm run build`:  npm run prerender  (script = `tsx scripts/prerender.mjs`)
//
// NO BROWSER. Guides are static data rendered with React on the server: this script
// uses Vite's SSR loader (ssrLoadModule) to run src/prerender-entry.tsx, which
// renderToStaticMarkup()s each guide, then injects the markup + <title>/<meta>/
// canonical into the built dist/index.html shell. Because it reuses the project's
// Vite config, there is no second bundler and no platform-specific browser binary —
// so it runs identically on macOS and on Cloudflare's Linux build (clean Node 22).
//
// English is prerendered (crawler-facing); the SPA re-renders on load and honors the
// visitor's language. SITE_ORIGIN overrides the canonical/sitemap origin at cutover:
//   SITE_ORIGIN=https://redmondcompass.com npm run prerender
import { createServer } from "vite";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const ORIGIN = process.env.SITE_ORIGIN ?? "https://app.redmondcompass.com";

if (!existsSync(path.join(DIST, "index.html"))) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}
const template = readFileSync(path.join(DIST, "index.html"), "utf8");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");

const vite = await createServer({
  root: ROOT,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true },
});

try {
  const { GUIDE_SLUGS, renderGuide } = await vite.ssrLoadModule("/src/prerender-entry.tsx");

  let ok = 0;
  for (const slug of GUIDE_SLUGS) {
    const { html, title, description, lang } = await renderGuide(slug, "en");
    let page = template
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escAttr(description)}$2`)
      .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
      .replace('<div id="root"></div>', `<div id="root">${html}</div>`);
    if (!/rel="canonical"/.test(page)) {
      page = page.replace("</head>", `<link rel="canonical" href="${ORIGIN}/${slug}">\n</head>`);
    }
    // Flat `<slug>.html` (not `<slug>/index.html`): Cloudflare Pages serves it at
    // the extensionless URL with a clean 200 — directory-style output gets a 308 to
    // the trailing-slash URL, which breaks old-site non-slash links' cutover
    // fidelity and litters redirects. sirv (vite preview) resolves it the same way.
    writeFileSync(path.join(DIST, `${slug}.html`), page);
    console.log(`  ✓ /${slug}  →  dist/${slug}.html  (${title})`);
    ok++;
  }

  // sitemap: core screens + every guide
  const CORE = ["/", "/search", "/events", "/community", "/resources"];
  const today = new Date().toISOString().slice(0, 10);
  const urls = [...CORE, ...GUIDE_SLUGS.map((s) => `/${s}`)]
    .map((u) => `  <url><loc>${ORIGIN}${u === "/" ? "" : u}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n");
  writeFileSync(
    path.join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
  console.log(`Prerendered ${ok}/${GUIDE_SLUGS.length} guides + sitemap.xml (origin ${ORIGIN})`);
} finally {
  await vite.close();
}
