/**
 * TanStack Query hooks — the read API the consumer screens use.
 * Each hook pulls the DataSource from context (useDataSource) and wraps a method,
 * so screens never touch a concrete source. Query keys are structured for easy
 * invalidation once writes (saved/follow, owner path) land in steps 6–7.
 */
import { useQuery } from "@tanstack/react-query";
import { useDataSource } from "./DataProvider";
import type { BusinessQuery, EventQuery, SearchQuery } from "./DataSource";
import type { ResourceCategory, ID } from "@/lib/types";

export const qk = {
  businesses: (q?: BusinessQuery) => ["businesses", q ?? {}] as const,
  business: (slug: string) => ["business", slug] as const,
  categories: () => ["categories"] as const,
  bulletins: (p?: { businessId?: ID; limit?: number }) => ["bulletins", p ?? {}] as const,
  events: (q?: EventQuery) => ["events", q ?? {}] as const,
  event: (id: ID) => ["event", id] as const,
  news: (p?: { limit?: number }) => ["news", p ?? {}] as const,
  newsArticle: (slug: string) => ["news-article", slug] as const,
  resources: (p?: { category?: ResourceCategory; text?: string }) => ["resources", p ?? {}] as const,
  search: (text: string, q?: SearchQuery) => ["search", text, q ?? {}] as const,
  recommendations: (businessId: ID) => ["recommendations", businessId] as const,
  currentUser: () => ["current-user"] as const,
};

export function useBusinesses(query?: BusinessQuery) {
  const ds = useDataSource();
  return useQuery({ queryKey: qk.businesses(query), queryFn: () => ds.listBusinesses(query) });
}

export function useBusiness(slug: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.business(slug ?? ""),
    queryFn: () => ds.getBusinessBySlug(slug!),
    enabled: !!slug,
  });
}

export function useBusinessById(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: ["business-by-id", id ?? ""] as const,
    queryFn: () => ds.getBusinessById(id!),
    enabled: !!id,
  });
}

export function useCategories() {
  const ds = useDataSource();
  return useQuery({ queryKey: qk.categories(), queryFn: () => ds.listCategories() });
}

export function useBulletins(params?: { businessId?: ID; limit?: number }) {
  const ds = useDataSource();
  return useQuery({ queryKey: qk.bulletins(params), queryFn: () => ds.listBulletins(params) });
}

export function useEvents(query?: EventQuery) {
  const ds = useDataSource();
  return useQuery({ queryKey: qk.events(query), queryFn: () => ds.listEvents(query) });
}

export function useEvent(id: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.event(id ?? ""),
    queryFn: () => ds.getEventById(id!),
    enabled: !!id,
  });
}

export function useNews(params?: { limit?: number }) {
  const ds = useDataSource();
  return useQuery({ queryKey: qk.news(params), queryFn: () => ds.listNews(params) });
}

export function useNewsArticle(slug: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.newsArticle(slug ?? ""),
    queryFn: () => ds.getNewsBySlug(slug!),
    enabled: !!slug,
  });
}

export function useResources(params?: { category?: ResourceCategory; text?: string }) {
  const ds = useDataSource();
  return useQuery({ queryKey: qk.resources(params), queryFn: () => ds.listResources(params) });
}

export function useSearch(text: string, query?: SearchQuery) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.search(text, query),
    queryFn: () => ds.search(text, query),
    enabled: text.trim().length > 0,
  });
}

export function useRecommendations(businessId: string | undefined) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.recommendations(businessId ?? ""),
    queryFn: () => ds.getRecommendations(businessId!),
    enabled: !!businessId,
  });
}

export function useCurrentUser() {
  const ds = useDataSource();
  return useQuery({ queryKey: qk.currentUser(), queryFn: () => ds.getCurrentUser() });
}
