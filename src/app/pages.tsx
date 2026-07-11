import { Navigate, useLocation } from "react-router-dom";
import { PagePlaceholder } from "./PagePlaceholder";
import { GUIDE_SLUGS } from "@/features/guides/registry";
import { tGlobal } from "@/i18n";

/**
 * Catch-all: redirect legacy Base44-site URLs, then 404. The old site resolved
 * some routes case-insensitively (/About and /News rendered) and used a few
 * paths the app renamed — keeping them alive matters for the Phase 3 cutover,
 * when redmondcompass.com links in the wild start hitting this app. Host-level
 * 301s can be generated from this same map at cutover.
 */
const CANONICAL = new Set([
  "/",
  "/search",
  "/search/results",
  "/events",
  "/community",
  "/resources",
  "/saved",
  "/account",
  "/login",
  "/claim",
  "/manage",
  "/gallery",
  ...GUIDE_SLUGS.map((s) => `/${s}`),
]);

const LEGACY: Record<string, string> = {
  "/directory": "/search", // the old site's directory page = the app's search
  "/news": "/community", // news lives on the Community screen (News tab)
  "/submit-event": "/manage/event/new",
  // squashed casings observed on the live site (/GettingSettled → lowercased here)
  ...Object.fromEntries(GUIDE_SLUGS.map((s) => [`/${s.replaceAll("-", "")}`, `/${s}`])),
};

export const NotFoundPage = () => {
  const { pathname, search } = useLocation();
  const lower = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  const target = LEGACY[lower] ?? (lower !== pathname && CANONICAL.has(lower) ? lower : null);
  if (target) return <Navigate to={target + search} replace />;
  return <PagePlaceholder title={tGlobal("error.notFound")} note={tGlobal("error.notFoundMsg")} />;
};
