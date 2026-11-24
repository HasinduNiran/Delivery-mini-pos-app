import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Pagination } from '@/api/types';

type PageResult<T, S> = {
  data: T[];
  pagination: Pagination;
  summary?: S;
};

// Page-by-page server list with filters.
// - `filterKey` identifies the current filters; when it changes the list goes
//   back to page 1.
// - The list reloads whenever its screen comes back into focus, so new sales
//   and payments show up without a manual refresh.
export function usePagedList<T, S = undefined>(
  fetchPage: (page: number) => Promise<PageResult<T, S>>,
  filterKey: string,
) {
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(filterKey);
  const [nonce, setNonce] = useState(0);
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [summary, setSummary] = useState<S | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const fetchRef = useRef(fetchPage);

  useEffect(() => {
    fetchRef.current = fetchPage;
  });

  // Filters changed -> start again from the first page.
  if (filterKey !== lastKey) {
    setLastKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    const id = ++requestId.current;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return fetchRef.current(page);
      })
      .then((res) => {
        if (cancelled || id !== requestId.current) return;
        setData(res.data);
        setPagination(res.pagination);
        setSummary(res.summary);
        setError(null);
        // Page fell off the end (e.g. after the last item was paid off).
        if (res.data.length === 0 && page > 1 && page > res.pagination.totalPages) {
          setPage(res.pagination.totalPages);
        }
      })
      .catch((err: Error) => {
        if (!cancelled && id === requestId.current) setError(err.message);
      })
      .finally(() => {
        if (!cancelled && id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filterKey, page, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  // Reload on re-focus (skip the first focus; the mount effect handles it).
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) setNonce((n) => n + 1);
      focusedOnce.current = true;
    }, []),
  );

  return {
    data,
    setData,
    page,
    setPage,
    pagination,
    summary,
    loading,
    refreshing,
    error,
    reload,
    refresh,
  };
}

// Delays a fast-changing value (e.g. search text) until typing pauses.
export function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
