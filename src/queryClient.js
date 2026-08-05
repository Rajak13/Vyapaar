/**
 * Singleton QueryClient shared across the whole app.
 * - staleTime: 60s  → data is "fresh" for 60 seconds; no background refetch during navigation
 * - gcTime:    5min → cached data is kept in memory for 5 minutes after all consumers unmount
 * - retry: 1        → retry failed requests once (handles brief network blips)
 */

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          60 * 1000,   // 60 seconds
      gcTime:             5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        if (error?.status === 401 || String(error?.message).includes('401')) return false
        return failureCount < 1
      },
      refetchOnWindowFocus: false,     // don't refetch just because user switched tabs
    },
  },
})
