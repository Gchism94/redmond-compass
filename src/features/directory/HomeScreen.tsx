import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ChevronRight, MapPin } from "lucide-react";
import {
  SearchField,
  Rail,
  ResultCard,
  EventCard,
  FeedItem,
  SectionHeader,
  CategoryGrid,
  Skeleton,
  ErrorState,
} from "@/components";
import { useBusinesses, useBulletins, useEvents, useNews, useBusinessMap } from "@/data/queries";
import { relativeTime } from "@/lib/format";
import { useSession } from "@/features/account/session";
import { InstallBanner } from "@/pwa/InstallPrompt";
import { LangToggle } from "@/components/LangToggle";
import type { Business } from "@/lib/types";
import { useI18n } from "@/i18n";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { WebHero } from "./WebHero";

/**
 * Home (S2). Personalized feed with a graceful cold-start — at MVP (pre-auth)
 * everyone sees the cold-start: town-wide "open now", popular bulletins + a
 * follow nudge, events, news, categories. Never an empty module. No featured slots.
 * Personalization (follows, recently-viewed) switches on with auth in step 6.
 */
export function HomeScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const session = useSession();
  const desktop = useIsDesktop();
  const origin = session.location ?? undefined;
  const locationSort = origin ? "distance" : "relevance";
  const [onlyOpen, setOnlyOpen] = useState(false);
  const openNow = useBusinesses({ openNow: true, sort: locationSort, limit: 8, origin });
  const bulletins = useBulletins();
  const events = useEvents({ limit: 3, origin });
  const news = useNews({ limit: 2 });
  // The rail only ever shows 8 — ask for 8, not for a 50-row page we then slice. (The old
  // `limit: 50` query was doing double duty as the rail fallback AND as the lookup table for
  // recently-viewed + bulletin attribution, which is what capped those two at 50.)
  const nearby = useBusinesses({ sort: locationSort, limit: 8, origin });

  // The signed-in home used to silently request open businesses and label the result rail
  // "Open now". That made a filter look like the default directory. Show the complete
  // nearby/relevant set first; residents can opt into the time-sensitive view explicitly.
  const railTitle = onlyOpen ? t("home.openNow") : t(origin ? "home.nearbyIn" : "home.placesIn");
  const railItems = onlyOpen ? (openNow.data?.items ?? []) : (nearby.data?.items ?? []);
  const railLoading = onlyOpen ? openNow.isLoading : nearby.isLoading;
  const railFailed = onlyOpen ? openNow.isError : nearby.isError;

  // Personalization (BUILD-BRIEF §12 step 6). Follow-feed when following anyone,
  // else t("home.popular"). Recently-viewed rail appears for returning users.
  const followed = session.followedBusinessIds;
  const followBulletins = (bulletins.data ?? []).filter((b) => followed.includes(b.businessId));
  const usingFollowFeed = followBulletins.length > 0;
  const feedTitle = usingFollowFeed ? t("home.fromFollowed") : t("home.popular");
  const feedBulletins = (usingFollowFeed ? followBulletins : (bulletins.data ?? [])).slice(0, 4);

  // Resolve recently-viewed + bulletin attribution by id, so neither is capped by a page.
  const lookupIds = useMemo(
    () => [...session.recentlyViewedIds, ...feedBulletins.map((bl) => bl.businessId)],
    [session.recentlyViewedIds, feedBulletins],
  );
  const { map: bizById } = useBusinessMap(lookupIds);

  const recentlyViewed = session.recentlyViewedIds
    .map((id) => bizById.get(id))
    .filter((b): b is Business => !!b)
    .slice(0, 8);

  return (
    <div className="pb-4">
      {/* Desktop (WebShell): the original site's hero + shortcut tiles.
          Mobile (AppShell): pinned-feel search header + install banner. */}
      {desktop ? (
        <WebHero />
      ) : (
        <>
          {/* "Greetings From Redmond" mural — the app's visual identity, which mobile was
              missing entirely while desktop led with it. IMAGE ONLY: the desktop hero's
              headline and four CTAs are deliberately not repeated here, because they already
              exist on this screen as the shortcut rails and the tab bar below.

              Reuses the SAME self-hosted asset as WebHero (/web/hero.jpg, 1200×600) — not a
              re-export — cropped to a short strip rather than its native 2:1, which at 437px
              would be 218px tall and push search well down the screen. Search is the primary
              mobile task, so the mural gets a band and the search field stays in reach. */}
          <div className="h-36 w-full overflow-hidden bg-foreground">
            <img
              src="/web/hero.jpg"
              alt=""
              /* 30% rather than centre: the mural's lettering sits in its upper-middle band,
                 and a centred crop of a 2:1 image cut "Greetings From" off the top. This
                 keeps the whole "Greetings From REDMOND Oregon" wordmark — the point of
                 including it — while the sky and grasses take the trim. */
              style={{ objectPosition: "center 30%" }}
              className="h-full w-full object-cover"
            />
          </div>

          <header className="relative -mt-3 rounded-t-xl bg-background px-4 pt-5 pb-2 shadow-[0_-10px_24px_-22px_rgba(8,41,84,0.5)]">
            <div className="flex items-center justify-between gap-2">
              <p className="font-heading text-2xl font-bold text-foreground">Redmond Compass</p>
              <LangToggle />
            </div>
            <div className="mt-3">
              <SearchField
                value=""
                onChange={() => {}}
                readOnlyButton
                onActivate={() => navigate("/search")}
                placeholder={t("home.searchPlaceholder")}
              />
            </div>
            <button
              type="button"
              onClick={() => navigate("/account")}
              className="mt-2.5 inline-flex min-h-tap items-center gap-1.5 rounded-pill border border-positive/25 bg-positive/10 px-3 py-1.5 text-xs font-semibold text-positive"
            >
              <MapPin size={13} /> {t(origin ? "home.nearYou" : "home.setLocation")}
            </button>
          </header>

          <InstallBanner />
        </>
      )}

      {/* Directory preview. "Open now" is an explicit, off-by-default filter. */}
      <Rail
        title={railTitle}
        seeAllHref={onlyOpen ? "/search/results?openNow=1" : origin ? "/search/results?sort=distance" : "/search/results"}
        headerAction={(
          <button
            type="button"
            role="switch"
            aria-checked={onlyOpen}
            data-home-open-now-toggle
            onClick={() => setOnlyOpen((value) => !value)}
            className="inline-flex min-h-tap items-center gap-2.5 rounded-pill border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-positive/40 hover:bg-positive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span
              aria-hidden
              className={`relative h-6 w-11 rounded-full transition-colors ${onlyOpen ? "bg-positive" : "bg-muted-foreground/30"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${onlyOpen ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </span>
            {t("search.openNow")}
          </button>
        )}
      >
        {railFailed ? (
          <ErrorState compact className="w-full" title={t("error.loadBusinesses")} onRetry={() => { openNow.refetch(); nearby.refetch(); }} />
        ) : railLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-36 shrink-0">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="mt-1.5 h-3.5 w-3/4" />
                <Skeleton className="mt-1 h-3.5 w-1/2" />
                <Skeleton className="mt-1 h-4 w-2/3" />
              </div>
            ))
          : railItems.length === 0 ? (
              <div className="w-full rounded-lg border border-dashed border-border bg-muted/30 px-4 py-4">
                <p className="text-sm font-medium text-foreground">{t("home.noOpenNow")}</p>
                <button
                  type="button"
                  onClick={() => setOnlyOpen(false)}
                  className="mt-2 inline-flex min-h-tap items-center text-sm font-semibold text-positive hover:underline"
                >
                  {t("home.showAllBusinesses")}
                </button>
              </div>
            ) : railItems.map((b) => (
              <ResultCard
                key={b.id}
                business={b}
                variant="rail"
                origin={origin}
                saved={session.isSaved(b.id)}
                onSave={() => session.toggleSaveBusiness(b.id)}
              />
            ))}
      </Rail>

      {/* Feed sections — single column on mobile; Popular · Events · News side by side on desktop */}
      <div className="lg:mt-3 lg:grid lg:grid-cols-3 lg:gap-5">
      {/* Follow feed → t("home.popular") cold-start fallback */}
      <section className="px-4 py-3 lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-5 lg:shadow-card">
        <SectionHeader title={feedTitle} seeAllHref="/community" />
        <div className="-my-1 divide-y divide-border">
          {bulletins.isError ? (
            <ErrorState compact title={t("error.loadNews")} onRetry={() => bulletins.refetch()} />
          ) : bulletins.isLoading
            ? Array.from({ length: 4 }).map((_, i) => <FeedRowSkeleton key={i} />)
            : feedBulletins.map((bl) => {
                const biz = bizById.get(bl.businessId);
                return (
                  <FeedItem
                    key={bl.id}
                    type="bulletin"
                    title={bl.body}
                    sourceLabel={biz?.name ?? t("home.aLocalBusiness")}
                    seed={biz?.name}
                    image={biz?.photos[0]}
                    businessCategory={biz?.category}
                    time={relativeTime(bl.createdAt)}
                    href={biz ? `/b/${biz.slug}` : undefined}
                    showTypeTag={false}
                  />
                );
              })}
        </div>
        {!usingFollowFeed && (
          <Link
            to="/search"
            className="mt-2 flex min-h-tap items-center justify-between gap-3 rounded-lg border border-dashed border-positive/40 bg-positive/5 px-3 py-2 text-xs text-positive transition-colors hover:border-positive/60 hover:bg-positive/10"
          >
            <span>
              <b className="font-semibold">{t("home.followHintStrong")}</b> {t("home.followHintRest")}
            </span>
            <ChevronRight aria-hidden size={16} className="shrink-0" />
          </Link>
        )}
      </section>

      {/* Upcoming events */}
      <section className="px-4 py-3 lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-5 lg:shadow-card">
        <SectionHeader title={t("home.upcomingEvents")} seeAllHref="/events" />
        <div className="-my-1 divide-y divide-border">
          {events.isError ? (
            <ErrorState compact title={t("error.loadEvents")} onRetry={() => events.refetch()} />
          ) : events.isLoading
            ? Array.from({ length: 3 }).map((_, i) => <FeedRowSkeleton key={i} />)
            : events.data?.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  saved={session.isSavedEvent(e.id)}
                  onSave={() => session.toggleSaveEvent(e.id)}
                />
              ))}
        </div>
      </section>

      {/* Local news */}
      <section className="px-4 py-3 lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-5 lg:shadow-card">
        <SectionHeader title={t("home.localNews")} seeAllHref="/community" />
        <div className="-my-1 divide-y divide-border">
          {news.isError ? (
            <ErrorState compact title={t("error.loadNews")} onRetry={() => news.refetch()} />
          ) : news.isLoading
            ? Array.from({ length: 2 }).map((_, i) => <FeedRowSkeleton key={i} />)
            : null}
          {news.data?.map((n) => (
            <FeedItem
              key={n.id}
              type="news"
              title={n.title}
              sourceLabel={n.source}
              seed={n.source}
              time={relativeTime(n.publishedAt)}
              image={n.image}
              excerpt={n.excerpt}
              category={n.category}
              href={`/news/${n.slug}`}
              showTypeTag={false}
            />
          ))}
        </div>
      </section>
      </div>

      {/* Browse by category */}
      <section className="px-4 py-4 lg:mt-4 lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-6 lg:shadow-card">
        <SectionHeader title={t("search.browseByCategory")} />
        <CategoryGrid />
      </section>

      {/* Recently viewed — returning users only (never an empty row) */}
      {recentlyViewed.length > 0 && (
        <Rail title={t("home.recentlyViewed")}>
          {recentlyViewed.map((b) => (
            <ResultCard
              key={b.id}
              business={b}
              variant="rail"
              origin={origin}
              saved={session.isSaved(b.id)}
              onSave={() => session.toggleSaveBusiness(b.id)}
            />
          ))}
        </Rail>
      )}

      {/* Secondary surfaces (no bottom tab) */}
      <section className="grid grid-cols-2 gap-3 px-4 py-2">
        <Link
          to="/community"
          className="flex min-h-tap items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground shadow-card transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift"
        >
          {t("home.communityNews")}
        </Link>
        <Link
          to="/resources"
          className="flex min-h-tap items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground shadow-card transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift"
        >
          {t("home.resources")}
        </Link>
      </section>
    </div>
  );
}

/** Skeleton sized to a FeedItem/EventCard row so loading→loaded doesn't shift layout (CLS). */
function FeedRowSkeleton() {
  return (
    <div className="flex gap-3 py-3">
      <Skeleton className="h-11 w-[54px] shrink-0 rounded-md" />
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
