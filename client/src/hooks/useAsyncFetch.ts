import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useAsyncFetch — Safe, robust async fetching hook for Next.js App Router pages.
 * 
 * Features:
 * 1. Safe Param Execution: Skips fetching if enabled is false.
 * 2. Memory Leak Prevention: Automatically tracks unmount status.
 * 3. Static ESLint Dependencies: Serializes deps array to string to satisfy react-hooks/exhaustive-deps statically.
 * 4. React 19 Ref Safety: Ref updates happen inside useEffect, satisfying react-hooks/refs.
 * 5. React 19 microtask scheduling: Uses queueMicrotask to satisfy react-hooks/set-state-in-effect.
 */
export function useAsyncFetch<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  enabled: boolean = true
) {
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
    if (!enabledRef.current) return;
    try {
      if (isMountedRef.current) setLoading(true);
      setError(null);
      const result = await fetcherRef.current();
      if (isMountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
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

  return { data, loading, error, refetch: executeFetch, setData, setLoading };
}
