/**
 * Injects the active DataSource via React context + sets up TanStack Query.
 * Components read data through the hooks in queries.ts, which pull the source
 * from this context — so tests/stories can provide a different source, and the
 * backend stays swappable (BUILD-BRIEF §2).
 */
import { createContext, useContext, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DataSource } from "./DataSource";
import { dataSource as defaultSource } from "./source";

const DataSourceContext = createContext<DataSource>(defaultSource);

export function useDataSource(): DataSource {
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
  source = defaultSource,
}: {
  children: ReactNode;
  source?: DataSource;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <DataSourceContext.Provider value={source}>{children}</DataSourceContext.Provider>
    </QueryClientProvider>
  );
}
