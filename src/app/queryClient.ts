import { QueryClient } from '@tanstack/react-query';

/** Shared QueryClient — persisted via PersistQueryClientProvider (see queryPersist.ts). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /** Fresh enough for UI; restored cache still shows immediately while revalidating. */
      staleTime: 60_000,
      /** Keep unused queries (incl. restored) for a day — matches persist maxAge. */
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
