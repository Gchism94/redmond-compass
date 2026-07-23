/**
 * Build-mode switch (App-Only Mode spec, 2026-07-22).
 *
 * `app-only` (current): redmondcompass.com stays live on Base44; this build ships
 * as THE APP at app.redmondcompass.com behind a marketing landing page at `/`.
 * The site-replacement surfaces (WebShell site home at `/`, the 13 guide pages as
 * public content) are ARCHIVED IN PLACE: still built and routable, but not linked,
 * `noindex`, cross-canonicaled to the live site, and absent from the sitemap.
 *
 * `full-site` (the real cutover): flips everything back — guides prerendered into
 * the sitemap and indexable, site home restored at `/`, landing retired.
 *
 * Reinstatement must stay a CONFIG FLIP, not a revert — never delete the guide
 * modules, WebShell home, redirect map, or prerender machinery to satisfy app-only.
 */
export type SiteMode = "app-only" | "full-site";

export const compassConfig: {
  siteMode: SiteMode;
  /** The live Base44-served site — the app links OUT to it, never reproduces it. */
  liveSite: string;
  /** This build's own public origin (canonical/sitemap/OG). */
  appOrigin: string;
} = {
  siteMode: "app-only",
  liveSite: "https://redmondcompass.com",
  appOrigin: "https://app.redmondcompass.com",
};
