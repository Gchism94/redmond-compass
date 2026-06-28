import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import {
  SearchField,
  Rail,
  ResultCard,
  EventCard,
  FeedItem,
  SectionHeader,
  CategoryGrid,
  Skeleton,
} from "@/components";
import { useBusinesses, useBulletins, useEvents, useNews } from "@/data/queries";
import { relativeTime } from "@/lib/format";
import { useSession } from "@/features/account/session";
import type { Business } from "@/lib/types";

/**
 * Home (S2). Personalized feed with a graceful cold-start — at MVP (pre-auth)
 * everyone sees the cold-start: town-wide "open now", popular bulletins + a
 * follow nudge, events, news, categories. Never an empty module. No featured slots.
 * Personalization (follows, recently-viewed) switches on with auth in step 6.
 */
export function HomeScreen() {
  const navigate = useNavigate();
  const session = useSession();
  const origin = session.location ?? undefined;
  const openNow = useBusinesses({ openNow: true, sort: "distance", limit: 8, origin });
  const bulletins = useBulletins();
  const events = useEvents({ limit: 3, origin });
  const news = useNews({ limit: 2 });
  const allBiz = useBusinesses({ limit: 50, origin });

  const bizById = useMemo(() => {
    const m = new Map<string, Business>();
    allBiz.data?.items.forEach((b) => m.set(b.id, b));
    return m;
  }, [allBiz.data]);

  // Never an empty module: if nothing's open right now (e.g. late night), the rail
  // degrades from "Open now" to "Nearby in Redmond" rather than going blank.
  const openItems = openNow.data?.items ?? [];
  const hasOpen = openItems.length > 0;
  const railTitle = hasOpen ? "Open now in Redmond" : "Nearby in Redmond";
  const railItems = hasOpen ? openItems : (allBiz.data?.items ?? []).slice(0, 8);
  const railLoading = openNow.isLoading || (!hasOpen && allBiz.isLoading);

  // Personalization (BUILD-BRIEF §12 step 6). Follow-feed when following anyone,
  // else "Popular this week". Recently-viewed rail appears for returning users.
  const followed = session.followedBusinessIds;
  const followBulletins = (bulletins.data ?? []).filter((b) => followed.includes(b.businessId));
  const usingFollowFeed = followBulletins.length > 0;
  const feedTitle = usingFollowFeed ? "From places you follow" : "Popular this week";
  const feedBulletins = (usingFollowFeed ? followBulletins : (bulletins.data ?? [])).slice(0, 4);

  const recentlyViewed = session.recentlyViewedIds
    .map((id) => bizById.get(id))
    .filter((b): b is Business => !!b)
    .slice(0, 8);

  return (
    <div className="pb-4">
      {/* Header — pinned-feel search + location */}
      <header className="bg-background px-4 pt-4 pb-2">
        <p className="font-heading text-2xl font-bold text-foreground">Redmond Compass</p>
        <div className="mt-3">
          <SearchField
            value=""
            onChange={() => {}}
            readOnlyButton
            onActivate={() => navigate("/search")}
            placeholder="Search Redmond…"
          />
        </div>
        <button
          type="button"
          onClick={() => navigate("/account")}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-pill border border-positive/25 bg-positive/10 px-3 py-1.5 text-xs font-semibold text-positive"
        >
          <MapPin size={13} /> Redmond, OR · Near you
        </button>
      </header>

      {/* Open now near you — degrades to "Nearby" when nothing is open */}
      <Rail title={railTitle} seeAllHref={hasOpen ? "/search/results?openNow=1" : "/search/results?sort=distance"}>
        {railLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-32 shrink-0">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="mt-2 h-4 w-3/4" />
                <Skeleton className="mt-1 h-3 w-1/2" />
              </div>
            ))
          : railItems.map((b) => (
              <ResultCard key={b.id} business={b} variant="rail" origin={origin} />
            ))}
      </Rail>

      {/* Follow feed → "Popular this week" cold-start fallback */}
      <section className="px-4 py-2">
        <SectionHeader title={feedTitle} seeAllHref="/community" />
        <div className="-my-1 divide-y divide-border">
          {bulletins.isLoading
            ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="my-3 h-12 w-full" />)
            : feedBulletins.map((bl) => {
                const biz = bizById.get(bl.businessId);
                return (
                  <FeedItem
                    key={bl.id}
                    type="bulletin"
                    title={bl.body}
                    sourceLabel={biz?.name ?? "A local business"}
                    seed={biz?.name}
                    time={relativeTime(bl.createdAt)}
                    href={biz ? `/b/${biz.slug}` : undefined}
                    showTypeTag={false}
                  />
                );
              })}
        </div>
        {!usingFollowFeed && (
          <div className="mt-2 rounded-lg border border-dashed border-positive/40 bg-positive/5 px-3 py-2.5 text-xs text-positive">
            <b className="font-semibold">Follow places</b> you like to make this feed yours.
          </div>
        )}
      </section>

      {/* Upcoming events */}
      <section className="px-4 py-2">
        <SectionHeader title="Upcoming events" seeAllHref="/events" />
        <div className="-my-1 divide-y divide-border">
          {events.isLoading
            ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="my-3 h-12 w-full" />)
            : events.data?.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      </section>

      {/* Local news */}
      <section className="px-4 py-2">
        <SectionHeader title="Local news" seeAllHref="/community" />
        <div className="-my-1 divide-y divide-border">
          {news.data?.map((n) => (
            <FeedItem
              key={n.id}
              type="news"
              title={n.title}
              sourceLabel={n.source}
              seed={n.source}
              time={relativeTime(n.publishedAt)}
              image={n.image}
              href={`/news/${n.slug}`}
              showTypeTag={false}
            />
          ))}
        </div>
      </section>

      {/* Browse by category */}
      <section className="px-4 py-3">
        <SectionHeader title="Browse by category" />
        <CategoryGrid />
      </section>

      {/* Recently viewed — returning users only (never an empty row) */}
      {recentlyViewed.length > 0 && (
        <Rail title="Recently viewed">
          {recentlyViewed.map((b) => (
            <ResultCard key={b.id} business={b} variant="rail" origin={origin} />
          ))}
        </Rail>
      )}

      {/* Secondary surfaces (no bottom tab) */}
      <section className="grid grid-cols-2 gap-3 px-4 py-2">
        <Link
          to="/community"
          className="flex min-h-tap items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground"
        >
          Community &amp; news
        </Link>
        <Link
          to="/resources"
          className="flex min-h-tap items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground"
        >
          Local resources
        </Link>
      </section>
    </div>
  );
}
