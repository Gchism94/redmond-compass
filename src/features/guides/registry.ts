import type { Guide } from "./types";

/**
 * Guide routes keep the live site's exact URLs (kebab-case, top-level) so nothing
 * breaks at the Phase 3 DNS cutover. Each content module is dynamically imported —
 * its EN+ES copy is a separate chunk fetched only when the page is visited.
 */
export const GUIDE_LOADERS: Record<string, () => Promise<{ guide: Guide }>> = {
  "about": () => import("./content/about"),
  "contact": () => import("./content/contact"),
  "new-to-the-area": () => import("./content/new-to-the-area"),
  "getting-settled": () => import("./content/getting-settled"),
  "help-essentials": () => import("./content/help-essentials"),
  "seasonal-safety": () => import("./content/seasonal-safety"),
  "get-outside": () => import("./content/get-outside"),
  "pets": () => import("./content/pets"),
  "senior-resources": () => import("./content/senior-resources"),
  "community-organizations": () => import("./content/community-organizations"),
  "for-business-owners": () => import("./content/for-business-owners"),
  "ember": () => import("./content/ember"),
};

export const GUIDE_SLUGS = Object.keys(GUIDE_LOADERS);
