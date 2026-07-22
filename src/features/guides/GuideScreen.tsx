import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Skeleton } from "@/components";
import { usePageMeta } from "@/lib/pageMeta";
import { useI18n } from "@/i18n";
import { GUIDE_LOADERS } from "./registry";
import { GuideView } from "./GuideView";
import type { Guide, GuideContent } from "./types";

/**
 * Client route for the migrated content pages (guides). One component, many pages:
 * the slug comes from the route, the copy from a lazy content module in the viewer's
 * language, then rendered by the shared <GuideView>. The prerender path renders the
 * same GuideView server-side (src/prerender-entry.tsx) — no browser needed.
 */
export function GuideScreen() {
  const { lang } = useI18n();
  // Normalize the path to a registry slug: React Router matches case-insensitively
  // (/About reaches this route) and hosts normalize trailing slashes (Cloudflare
  // Pages 308s directory-style URLs to "/getting-settled/") — strip both, or the
  // loader lookup misses and the page would sit on its skeleton forever.
  const slug = useLocation().pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  const [guide, setGuide] = useState<Guide | null>(null);

  useEffect(() => {
    let on = true;
    setGuide(null);
    GUIDE_LOADERS[slug]?.().then((m) => on && setGuide(m.guide));
    return () => {
      on = false;
    };
  }, [slug]);

  const c: GuideContent | undefined = guide?.[lang];
  usePageMeta(c?.metaTitle, c?.metaDescription);

  if (!c) {
    return (
      <div className="space-y-3 px-4 pt-4">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return <GuideView content={c} />;
}
