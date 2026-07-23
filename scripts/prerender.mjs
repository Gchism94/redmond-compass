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
  const { compassConfig } = await vite.ssrLoadModule("/compass.config.ts");
  const { GUIDE_SLUGS, renderGuide } = await vite.ssrLoadModule("/src/prerender-entry.tsx");
  const appOnly = compassConfig.siteMode === "app-only";
  const LIVE = compassConfig.liveSite.replace(/\/+$/, "");
  if (appOnly) console.log("Mode: app-only — guides archived (noindex, canonical → live site), 1-URL sitemap.\n");

  const setCanonical = (page, href) =>
    // index.html ships a shell canonical — REPLACE it (never stack a second one).
    page.replace(/<link rel="canonical" href="[^"]*" ?\/?>/, `<link rel="canonical" href="${href}" />`);

  let ok = 0;
  for (const slug of GUIDE_SLUGS) {
    const { html, title, description, lang } = await renderGuide(slug, "en");
    let page = template
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escAttr(description)}$2`)
      .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
      .replace('<div id="root"></div>', `<div id="root">${html}</div>`);

    if (appOnly) {
      // Archived (App-Only spec §3): never compete with the live site. noindex +
      // canonical to the LIVE equivalent (privacy is ours alone — app-origin canonical).
      page = page.replace(
        "</head>",
        `<meta name="robots" content="noindex,follow">\n</head>`,
      );
      page = setCanonical(page, slug === "privacy" ? `${ORIGIN}/privacy` : `${LIVE}/${slug}`);
    } else {
      page = setCanonical(page, `${ORIGIN}/${slug}`);
    }
    // Flat `<slug>.html` (not `<slug>/index.html`): Cloudflare Pages serves it at
    // the extensionless URL with a clean 200 — directory-style output gets a 308 to
    // the trailing-slash URL, which breaks old-site non-slash links' cutover
    // fidelity and litters redirects. sirv (vite preview) resolves it the same way.
    writeFileSync(path.join(DIST, `${slug}.html`), page);
    console.log(`  ✓ /${slug}  →  dist/${slug}.html  (${title})${appOnly ? "  [noindex]" : ""}`);
    ok++;
  }

  // ---- sitemap: app-only = the landing page ONLY; full-site = core + guides ----
  const today = new Date().toISOString().slice(0, 10);
  const urls = (appOnly ? ["/"] : ["/", "/search", "/events", "/community", "/resources", ...GUIDE_SLUGS.map((s) => `/${s}`)])
    .map((u) => `  <url><loc>${ORIGIN}${u === "/" ? "" : u}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n");
  writeFileSync(
    path.join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );

  // ---- robots.txt per mode (overwrites the copy from public/) ----
  const robots = appOnly
    ? [
        "User-agent: *",
        // default-allow; ONLY the archived guide/content routes are blocked — the
        // live site owns that content for now. /privacy stays crawlable so its
        // noindex is actually seen (it's the app's own policy, no live equivalent).
        ...GUIDE_SLUGS.filter((s) => s !== "privacy").map((s) => `Disallow: /${s}`),
        "",
        `Sitemap: ${ORIGIN}/sitemap.xml`,
        "",
      ].join("\n")
    : `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
  writeFileSync(path.join(DIST, "robots.txt"), robots);

  console.log(`Prerendered ${ok}/${GUIDE_SLUGS.length} guides + sitemap.xml (${appOnly ? "1 URL" : "full"}) + robots.txt (origin ${ORIGIN})`);
} finally {
  await vite.close();
}
