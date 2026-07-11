import { useMemo, useState } from "react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Toggle, FeedItem, Skeleton } from "@/components";
import { useNews, useBulletins, useBusinesses } from "@/data/queries";
import { relativeTime } from "@/lib/format";
import type { Business } from "@/lib/types";
import { useI18n } from "@/i18n";

type Tab = "all" | "news" | "bulletins";

type Entry =
  | { kind: "news"; id: string; title: string; source: string; time: string; ts: number; slug: string; image?: string }
  | { kind: "bulletin"; id: string; title: string; source: string; seed?: string; time: string; ts: number; href?: string };

/** Community / News (C). Blended feed of admin news + business bulletins, type-tagged. */
export function CommunityScreen() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("all"); // default All (BUILD-BRIEF §14 — flagged)
  const news = useNews();
  const bulletins = useBulletins();
  const allBiz = useBusinesses({ limit: 50 });

  const bizById = useMemo(() => {
    const m = new Map<string, Business>();
    allBiz.data?.items.forEach((b) => m.set(b.id, b));
    return m;
  }, [allBiz.data]);

  const entries = useMemo<Entry[]>(() => {
    const n: Entry[] = (news.data ?? []).map((a) => ({
      kind: "news",
      id: a.id,
      title: a.title,
      source: a.source,
      time: relativeTime(a.publishedAt),
      ts: +new Date(a.publishedAt),
      slug: a.slug,
      image: a.image,
    }));
    const b: Entry[] = (bulletins.data ?? []).map((bl) => {
      const biz = bizById.get(bl.businessId);
      return {
        kind: "bulletin",
        id: bl.id,
        title: bl.body,
        source: biz?.name ?? t("community.localBusiness"),
        seed: biz?.name,
        time: relativeTime(bl.createdAt),
        ts: +new Date(bl.createdAt),
        href: biz ? `/b/${biz.slug}` : undefined,
      };
    });
    const merged = tab === "news" ? n : tab === "bulletins" ? b : [...n, ...b];
    return merged.sort((x, y) => y.ts - x.ts);
  }, [news.data, bulletins.data, bizById, tab]);

  const loading = news.isLoading || bulletins.isLoading;

  return (
    <div className="pb-4">
      <ScreenHeader title={t("community.title")} />
      <div className="px-4 pt-1">
        <Toggle
          ariaLabel={t("community.filter")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: t("community.tab.all") },
            { value: "news", label: t("community.tab.news") },
            { value: "bulletins", label: t("community.tab.bulletins") },
          ]}
        />
      </div>

      <div className="px-4">
        {loading ? (
          <div className="space-y-3 pt-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border pt-1">
            {entries.map((e) => (
              <FeedItem
                key={`${e.kind}-${e.id}`}
                type={e.kind}
                title={e.title}
                sourceLabel={e.source}
                seed={e.kind === "bulletin" ? e.seed : e.source}
                image={e.kind === "news" ? e.image : undefined}
                time={e.time}
                href={e.kind === "news" ? `/news/${e.slug}` : e.href}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
