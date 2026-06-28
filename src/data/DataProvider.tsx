/**
 * Injects the active DataSource via React context + sets up TanStack Query.
 * The source is loaded ON DEMAND (dynamic import — see source.ts), so the context
 * carries a getter `() => Promise<DataSource>` rather than the instance. Query/mutation
 * functions await it, which keeps screens in their loading (skeleton) state until the
 * source resolves — no empty flash, and the data lib stays out of the entry chunk.
 * Tests/stories can still inject a concrete source via the `source` prop.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DataSource } from "./DataSource";
import { getDataSource } from "./source";

type DataSourceGetter = () => Promise<DataSource>;

const DataSourceContext = createContext<DataSourceGetter>(getDataSource);

/** Returns a getter that resolves the active DataSource (cached after first load). */
export function useDataSource(): DataSourceGetter {
  return useContext(DataSourceContext);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function DataProvider({
  children,
  source,
}: {
  children: ReactNode;
  /** Inject a concrete source (tests/stories); otherwise the configured one loads on demand. */
  source?: DataSource;
}) {
  const getter = useMemo<DataSourceGetter>(
    () => (source ? () => Promise.resolve(source) : getDataSource),
    [source],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <DataSourceContext.Provider value={getter}>{children}</DataSourceContext.Provider>
    </QueryClientProvider>
  );
}
