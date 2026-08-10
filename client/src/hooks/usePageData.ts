import { useState, useEffect, useCallback, useRef } from 'react';

export interface UsePageDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * usePageData — Unified custom hook for data fetching in Client page.tsx files.
 * 
 * Benefits & Permanently Solved Issues:
 * 1. Automatic Re-fetching: Triggered on mount and whenever `deps` change (tracked via primitive `depsKey`).
 * 2. React 19 microtask scheduling: Uses queueMicrotask to satisfy react-hooks/set-state-in-effect.
 * 3. React 19 Ref Safety: Ref updates happen inside useEffect, satisfying react-hooks/refs.
 * 4. Memory Leak Prevention: Tracks component unmounting with `isMountedRef`.
 * 5. Automatic Parameter Guarding: Skips fetching when `enabled` is false.
 */
export function usePageData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  enabled: boolean = true
): UsePageDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);
  
  const isMountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    fetcherRef.current = fetcher;
    enabledRef.current = enabled;
  });

  const depsKey = JSON.stringify(deps);

  const executeFetch = useCallback(async () => {
    if (!enabledRef.current) {
      if (isMountedRef.current) setLoading(false);
      return;
    }

    try {
      if (isMountedRef.current) setLoading(true);
      setError(null);
      const result = await fetcherRef.current();
      if (isMountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        console.error('[usePageData] Fetch error:', errorObj);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    queueMicrotask(() => {
      if (isMountedRef.current) {
        executeFetch();
      }
    });

    return () => {
      isMountedRef.current = false;
    };
  }, [depsKey, enabled, executeFetch]);

  return { data, loading, error, refetch: executeFetch, setData };
}
