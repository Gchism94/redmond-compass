import { useMemo, useState } from "react";
import { ChevronDown, Newspaper } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Toggle, FeedItem, Skeleton, EmptyState, ErrorState } from "@/components";
import { useNews, useBulletins, useBusinessMap, useCommunityNotices } from "@/data/queries";
import { relativeTime, formatNoticeDate } from "@/lib/format";
import type { CommunityNotice } from "@/lib/types";
import { useI18n } from "@/i18n";

type Tab = "all" | "news" | "bulletins";

type Entry =
  | { kind: "news"; id: string; title: string; source: string; time: string; ts: number; slug: string; image?: string; excerpt?: string; category?: string }
  | { kind: "bulletin"; id: string; title: string; source: string; seed?: string; time: string; ts: number; href?: string; image?: string; businessCategory?: string };

const RECENT_CONTENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type ExpirableNotice = CommunityNotice & { activeUntil?: string };

/**
 * Notice prominence is intentionally time-bounded when editorial expiration data is
 * absent. A source-provided active-until date always wins; otherwise a notice gets 30 days
 * in the primary board before moving to the dated archive below it.
 */
function isCurrentNotice(notice: ExpirableNotice, now: number): boolean {
  if (notice.activeUntil) {
    const activeUntil = Date.parse(notice.activeUntil);
    if (!Number.isNaN(activeUntil)) return activeUntil >= now;
  }

  const createdAt = Date.parse(notice.createdAt);
  return !Number.isNaN(createdAt) && now - createdAt <= RECENT_CONTENT_WINDOW_MS;
}

function NoticeCard({ notice, past = false }: { notice: CommunityNotice; past?: boolean }) {
  const { t, lang } = useI18n();
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-heading text-sm font-semibold leading-tight text-foreground">
          {notice.title}
        </p>
        {(past || notice.pinned) && (
          <span className="mt-0.5 shrink-0 rounded-pill border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {t(past ? "community.pastNotice" : "community.pinned")}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{formatNoticeDate(notice.createdAt, lang)}</p>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground">{notice.body}</p>
    </li>
  );
}

/** Community / News (C). Blended feed of admin news + business bulletins, type-tagged. */
export function CommunityScreen() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>("all"); // default All (BUILD-BRIEF §14 — flagged)
  const [now] = useState(() => Date.now());
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
      excerpt: a.excerpt,
      category: a.category,
    }));
    const b: Entry[] = (bulletins.data ?? []).map((bl) => {
      const biz = bizById.get(bl.businessId);
      return {
        kind: "bulletin",
        id: bl.id,
        title: bl.body,
        source: biz?.name ?? t("community.localBusiness"),
        seed: biz?.name,
        image: biz?.photos[0],
        businessCategory: biz?.category,
        time: relativeTime(bl.createdAt),
        ts: +new Date(bl.createdAt),
        href: biz ? `/b/${biz.slug}` : undefined,
      };
    });
    const merged = tab === "news" ? n : tab === "bulletins" ? b : [...n, ...b];
    return merged.sort((x, y) => y.ts - x.ts);
  }, [news.data, bulletins.data, bizById, tab, t]);

  const loading = news.isLoading || bulletins.isLoading;
  // Both feeds must fail before the whole screen errors; one alone just contributes less.
  const failed = news.isError && bulletins.isError;
  const currentNotices: CommunityNotice[] = [];
  const pastNotices: CommunityNotice[] = [];
  for (const notice of notices.data ?? []) {
    (isCurrentNotice(notice as ExpirableNotice, now) ? currentNotices : pastNotices).push(notice);
  }
  pastNotices.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  let latestNewsTimestamp = Number.NEGATIVE_INFINITY;
  for (const article of news.data ?? []) {
    const timestamp = Date.parse(article.publishedAt);
    if (Number.isFinite(timestamp) && timestamp > latestNewsTimestamp) latestNewsTimestamp = timestamp;
  }
  const showNewsAge =
    (tab === "all" || tab === "news") &&
    Number.isFinite(latestNewsTimestamp) &&
    now - latestNewsTimestamp > RECENT_CONTENT_WINDOW_MS;

  return (
    <div className="pb-4">
      <ScreenHeader title={t("community.title")} />
      {/* Town notices stay separate from owner bulletins. Current notices receive 30 days
          of prominence unless the source supplies an explicit active-until value. Older
          notices remain available, with their authored text and absolute Redmond-local
          date intact, inside the collapsed archive. */}
      {notices.isError ? (
        <section className="px-4 pt-2">
          <ErrorState compact title={t("error.loadNotices")} onRetry={() => notices.refetch()} />
        </section>
      ) : (
        <>
          {currentNotices.length > 0 && (
            <section className="px-4 pt-2">
              <h2 className="font-heading text-sm font-semibold text-foreground">{t("community.notices")}</h2>
              <ul className="mt-2 space-y-2">
                {currentNotices.map((notice) => <NoticeCard key={notice.id} notice={notice} />)}
              </ul>
            </section>
          )}
        </>
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
        {showNewsAge && (
          <p role="status" className="mt-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {t("community.newsLastUpdated", {
              date: formatNoticeDate(new Date(latestNewsTimestamp).toISOString(), lang),
            })}
          </p>
        )}
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
          <div className="space-y-2 pt-2">
            {entries.map((e) => (
              <FeedItem
                key={`${e.kind}-${e.id}`}
                type={e.kind}
                title={e.title}
                sourceLabel={e.source}
                seed={e.kind === "bulletin" ? e.seed : e.source}
                image={e.kind === "news" ? e.image : undefined}
                excerpt={e.kind === "news" ? e.excerpt : undefined}
                category={e.kind === "news" ? e.category : undefined}
                businessCategory={e.kind === "bulletin" ? e.businessCategory : undefined}
                time={e.time}
                href={e.kind === "news" ? `/news/${e.slug}` : e.href}
                card
              />
            ))}
          </div>
        )}
      </div>
      {!notices.isError && pastNotices.length > 0 && (
        <details className="group mx-4 mt-4 rounded-lg border border-border bg-surface-sunken px-3">
          <summary className="flex min-h-tap cursor-pointer list-none items-center text-sm font-semibold text-muted-foreground">
            <span>{t("community.pastNotices", { n: String(pastNotices.length) })}</span>
            <ChevronDown size={16} className="ml-auto transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="space-y-2 pb-3">
            {pastNotices.map((notice) => <NoticeCard key={notice.id} notice={notice} past />)}
          </ul>
        </details>
      )}
    </div>
  );
}
