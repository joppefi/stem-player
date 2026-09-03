import { useCallback, useEffect, useRef, useState } from "react";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches JSON from `url` and tracks it as { data, loading, error }.
 * Pass `null`/`undefined` as the url to skip fetching (e.g. while some
 * prerequisite value isn't known yet). Re-fetches whenever `url` changes,
 * and aborts the in-flight request on unmount/url change/refetch.
 */
export function useApi<T>(url: string | null | undefined, options?: RequestInit): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(url, { ...optionsRef.current, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as T;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Request failed");
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [url, refetchToken]);

  const refetch = useCallback(() => setRefetchToken((n) => n + 1), []);

  return { data, loading, error, refetch };
}

export default useApi;
