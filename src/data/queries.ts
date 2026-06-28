/**
 * TanStack Query hooks — the read API the consumer screens use.
 * Each hook pulls the DataSource getter from context (useDataSource) and awaits it in
 * the query/mutation fn, so screens never touch a concrete source AND stay in their
 * loading state until the (lazily-loaded) source resolves. Query keys are structured
 * for easy cache invalidation by the owner-path + recommend mutations.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataSource } from "./DataProvider";
import type {
  BusinessQuery,
  EventQuery,
  SearchQuery,
  NewBusinessInput,
  NewBulletinInput,
  NewEventInput,
} from "./DataSource";
import type { Business, ResourceCategory, ID } from "@/lib/types";

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
  const getDS = useDataSource();
  return useQuery({ queryKey: qk.businesses(query), queryFn: async () => (await getDS()).listBusinesses(query) });
}

export function useBusiness(slug: string | undefined) {
  const getDS = useDataSource();
  return useQuery({
    queryKey: qk.business(slug ?? ""),
    queryFn: async () => (await getDS()).getBusinessBySlug(slug!),
    enabled: !!slug,
  });
}

export function useBusinessById(id: string | undefined) {
  const getDS = useDataSource();
  return useQuery({
    queryKey: ["business-by-id", id ?? ""] as const,
    queryFn: async () => (await getDS()).getBusinessById(id!),
    enabled: !!id,
  });
}

export function useCategories() {
  const getDS = useDataSource();
  return useQuery({ queryKey: qk.categories(), queryFn: async () => (await getDS()).listCategories() });
}

export function useBulletins(params?: { businessId?: ID; limit?: number }) {
  const getDS = useDataSource();
  return useQuery({ queryKey: qk.bulletins(params), queryFn: async () => (await getDS()).listBulletins(params) });
}

export function useEvents(query?: EventQuery) {
  const getDS = useDataSource();
  return useQuery({ queryKey: qk.events(query), queryFn: async () => (await getDS()).listEvents(query) });
}

export function useEvent(id: string | undefined) {
  const getDS = useDataSource();
  return useQuery({
    queryKey: qk.event(id ?? ""),
    queryFn: async () => (await getDS()).getEventById(id!),
    enabled: !!id,
  });
}

export function useNews(params?: { limit?: number }) {
  const getDS = useDataSource();
  return useQuery({ queryKey: qk.news(params), queryFn: async () => (await getDS()).listNews(params) });
}

export function useNewsArticle(slug: string | undefined) {
  const getDS = useDataSource();
  return useQuery({
    queryKey: qk.newsArticle(slug ?? ""),
    queryFn: async () => (await getDS()).getNewsBySlug(slug!),
    enabled: !!slug,
  });
}

export function useResources(params?: { category?: ResourceCategory; text?: string }) {
  const getDS = useDataSource();
  return useQuery({ queryKey: qk.resources(params), queryFn: async () => (await getDS()).listResources(params) });
}

export function useSearch(text: string, query?: SearchQuery) {
  const getDS = useDataSource();
  return useQuery({
    queryKey: qk.search(text, query),
    queryFn: async () => (await getDS()).search(text, query),
    enabled: text.trim().length > 0,
  });
}

export function useRecommendations(businessId: string | undefined) {
  const getDS = useDataSource();
  return useQuery({
    queryKey: qk.recommendations(businessId ?? ""),
    queryFn: async () => (await getDS()).getRecommendations(businessId!),
    enabled: !!businessId,
  });
}

export function useHasRecommended(businessId: string | undefined) {
  const getDS = useDataSource();
  return useQuery({
    queryKey: ["has-recommended", businessId ?? ""] as const,
    queryFn: async () => (await getDS()).hasRecommended(businessId!),
    enabled: !!businessId,
  });
}

export function useRecommend() {
  const getDS = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (businessId: ID) => (await getDS()).recommend(businessId),
    onSuccess: (_d, businessId) => {
      qc.invalidateQueries({ queryKey: qk.recommendations(businessId) });
      qc.invalidateQueries({ queryKey: ["has-recommended", businessId] });
    },
  });
}

export function useCurrentUser() {
  const getDS = useDataSource();
  return useQuery({ queryKey: qk.currentUser(), queryFn: async () => (await getDS()).getCurrentUser() });
}

export function useBulletinCount(businessId: string | undefined) {
  const getDS = useDataSource();
  return useQuery({
    queryKey: ["bulletin-count", businessId ?? ""] as const,
    queryFn: async () => (await getDS()).countBulletinsThisMonth(businessId!),
    enabled: !!businessId,
  });
}

// ---- Owner mutations (step 7). Invalidate the read caches the change affects. ----
function useInvalidateBusiness() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["businesses"] });
    qc.invalidateQueries({ queryKey: ["business"] });
    qc.invalidateQueries({ queryKey: ["business-by-id"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["search"] });
  };
}

export function useCreateBusiness() {
  const getDS = useDataSource();
  const invalidate = useInvalidateBusiness();
  return useMutation({
    mutationFn: async (input: NewBusinessInput) => (await getDS()).createBusiness(input),
    onSuccess: invalidate,
  });
}

export function useUpdateBusiness() {
  const getDS = useDataSource();
  const invalidate = useInvalidateBusiness();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: ID; patch: Partial<Business> }) =>
      (await getDS()).updateBusiness(id, patch),
    onSuccess: invalidate,
  });
}

export function useClaimBusiness() {
  const getDS = useDataSource();
  const invalidate = useInvalidateBusiness();
  return useMutation({
    mutationFn: async ({ id, ownerId }: { id: ID; ownerId: ID }) =>
      (await getDS()).claimBusiness(id, ownerId),
    onSuccess: invalidate,
  });
}

export function useCreateBulletin() {
  const getDS = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewBulletinInput) => (await getDS()).createBulletin(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bulletins"] });
      qc.invalidateQueries({ queryKey: ["bulletin-count"] });
      qc.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useCreateEvent() {
  const getDS = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewEventInput) => (await getDS()).createEvent(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["search"] });
    },
  });
}
