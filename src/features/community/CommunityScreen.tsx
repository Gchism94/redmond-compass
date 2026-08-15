import { useMemo, useState } from "react";
import { Newspaper } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Toggle, FeedItem, Skeleton, EmptyState, ErrorState } from "@/components";
import { useNews, useBulletins, useBusinessMap, useCommunityNotices } from "@/data/queries";
import { relativeTime, formatNoticeDate } from "@/lib/format";
import { useI18n } from "@/i18n";

type Tab = "all" | "news" | "bulletins";

type Entry =
  | { kind: "news"; id: string; title: string; source: string; time: string; ts: number; slug: string; image?: string }
  | { kind: "bulletin"; id: string; title: string; source: string; seed?: string; time: string; ts: number; href?: string };

/** Community / News (C). Blended feed of admin news + business bulletins, type-tagged. */
export function CommunityScreen() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>("all"); // default All (BUILD-BRIEF §14 — flagged)
  const news = useNews();
  const bulletins = useBulletins();
  const notices = useCommunityNotices();
  // Attribute each bulletin to its business by fetching exactly the businesses the feed
  // references. This used to read from a `limit: 50` page, so a bulletin from a business
  // ranked 51st+ lost its name and its link and rendered as a generic "a local business".
  const bulletinBizIds = useMemo(
    () => (bulletins.data ?? []).map((bl) => bl.businessId),
    [bulletins.data],
  );
  const { map: bizById } = useBusinessMap(bulletinBizIds);

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
  // Both feeds must fail before the whole screen errors; one alone just contributes less.
  const failed = news.isError && bulletins.isError;

  return (
    <div className="pb-4">
      <ScreenHeader title={t("community.title")} />
      {/* Town notices — the community board.
          A SEPARATE SECTION rather than a fourth tab, for two reasons. "Bulletins" already
          means owner posts on this very screen, and two different things under one word is
          how a reader learns to distrust both. And notices sort PINNED-first, which would
          fight the feed's reverse-chronological order if they shared it.

          Every notice shows an ABSOLUTE DATE, always, in REDMOND's time zone. These are
          read to decide whether guidance still applies, and a notice that is quietly six
          weeks old reads as current. There is deliberately NO staleness threshold in code:
          one row is not enough to invent a cutoff from and any cutoff is wrong for the next
          notice — a road closure is stale in a week, a memorial never is. The date lets the
          reader judge; a magic number would make that judgement for them, wrongly.

          Images and support links are not rendered in v1: the only live row's image is on
          the expiring base44 CDN, and a donation link is a trust surface that deserves its
          own design rather than arriving as a side effect. */}
      {(notices.data?.length ?? 0) > 0 && (
        <section className="px-4 pt-2">
          <h2 className="font-heading text-sm font-semibold text-foreground">{t("community.notices")}</h2>
          <ul className="mt-2 space-y-2">
            {notices.data!.map((n) => (
              <li key={n.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-heading text-sm font-semibold leading-tight text-foreground">
                    {n.title}
                  </p>
                  {n.pinned && (
                    <span className="mt-0.5 shrink-0 rounded-pill border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {t("community.pinned")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatNoticeDate(n.createdAt, lang)}</p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

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
        ) : failed ? (
          <ErrorState
            title={t("error.loadNews")}
            onRetry={() => {
              news.refetch();
              bulletins.refetch();
            }}
          />
        ) : entries.length === 0 ? (
          // keys existed but were never wired — a blank feed used to render an empty div (#7)
          <EmptyState
            icon={<Newspaper size={20} />}
            title={t("community.empty")}
            message={t("community.emptyMsg")}
            action={{ label: t("search.title"), href: "/search" }}
          />
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
