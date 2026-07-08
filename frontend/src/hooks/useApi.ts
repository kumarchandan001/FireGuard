/**
 * FireGuard AI — useApi Hook
 *
 * Generic data fetching hook with loading, error, and refresh support.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, ApiError } from '../api/client';

interface UseApiOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Polling interval in ms (0 = no polling) */
  pollInterval?: number;
}

interface UseApiReturn<T, M = any> {
  data: T | null;
  meta: M | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useApi<T, M = any>(
  path: string,
  options: UseApiOptions = {},
): UseApiReturn<T, M> {
  const { autoFetch = true, pollInterval = 0 } = options;
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<M | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ data: T; meta: M }>(path);
      setData(response.data);
      setMeta(response.meta);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }

    if (pollInterval > 0) {
      timerRef.current = setInterval(fetchData, pollInterval);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [autoFetch, pollInterval, fetchData]);

  return { data, meta, loading, error, refresh: fetchData };
}
