import { Skeleton } from "../ui/Skeleton";

/** Suspense fallback shown while a lazily-loaded route chunk loads. */
export function RouteFallback() {
  return (
    <div className="space-y-4 px-4 pt-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-11 w-full" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-32 shrink-0 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
