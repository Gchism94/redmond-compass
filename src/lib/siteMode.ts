import { compassConfig } from "@config";

/**
 * App-only-mode helpers (see compass.config.ts). Components use these instead of
 * branching on the config directly, so the full-site reinstatement is one flip.
 */
export const appOnly = compassConfig.siteMode === "app-only";
export const LIVE_SITE = compassConfig.liveSite;
export const APP_ORIGIN = compassConfig.appOrigin;

/** Where the app's home screen lives ("/" full-site; "/home" behind the landing). */
export const HOME_PATH = appOnly ? "/home" : "/";

/**
 * Link target for a guide/content page. In app-only mode the guides are archived
 * (built, noindexed) and the LIVE site serves that content — so in-app links point
 * OUT to redmondcompass.com; full-site mode links internally.
 */
export function guideLink(slug: string): { href: string; external: boolean } {
  return appOnly
    ? { href: `${LIVE_SITE}/${slug}`, external: true }
    : { href: `/${slug}`, external: false };
}
