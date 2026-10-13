import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  fetchQuery,
  getSnapshot,
  getServerSnapshot,
  subscribe,
  invalidate,
  registerFetcher,
  markStale,
  serializeKey,
} from "../lib/queryCache";

const FOCUS_REFRESH_MS = 60_000;

/**
 * Shared data hook.
 *
 * Replaces the per-page `useEffect + useState + fetch* + Refresh button`
 * pattern with one consistent mechanism that:
 *   - de-duplicates concurrent requests,
 *   - never lets a slow response overwrite a newer one,
 *   - re-fetches when the tab regains focus,
 *   - keeps previous data visible while refreshing (no layout jump),
 *   - keeps previous data visible when a background refresh fails.
 *
 * `staleTime` controls how long data is considered fresh (no refetch).
 * `poll` enables background refresh while the tab is visible.
 */
export const useQuery = (key, fetcher, options = {}) => {
  const { enabled = true, staleTime = 30_000, poll = 0, refetchOnFocus = true } = options;

  const id = serializeKey(key);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // `key` is an array literal at most call sites, so its identity changes on
  // every render. Holding it in a ref keeps the store callbacks stable while
  // still reading the current value.
  const keyRef = useRef(key);
  keyRef.current = key;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const subscribeTo = useCallback((listener) => subscribe(keyRef.current, listener), []);
  const readSnapshot = useCallback(() => getSnapshot(keyRef.current), []);

  const snapshot = useSyncExternalStore(subscribeTo, readSnapshot, getServerSnapshot);

  // Keep the latest fetcher reachable from the cache for invalidation.
  useEffect(() => {
    if (enabled) registerFetcher(key, () => fetcherRef.current());
  }, [id, enabled, key]);

  const run = useCallback(
    (opts) => fetchQuery(key, () => fetcherRef.current(), { staleTime, ...opts }),
    // `key` is an array literal at most call sites; `id` is its stable
    // serialisation, which is the value the cache is actually keyed on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, staleTime]
  );

  // Initial load / re-fetch when the key changes.
  useEffect(() => {
    if (!enabled) return;
    run().catch(() => {});
  }, [id, enabled, run]);

  // Refetch when the tab becomes visible again after being hidden.
  useEffect(() => {
    if (!enabled || !refetchOnFocus) return undefined;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        run().catch(() => {});
      }
    };

    // Refresh a stale entry shortly after mount, then whenever the tab
    // becomes visible again.
    const initial = setTimeout(onVisible, FOCUS_REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(initial);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, enabled, refetchOnFocus, run]);

  // Optional background polling - paused entirely while the tab is hidden.
  useEffect(() => {
    if (!enabled || !poll) return undefined;

    let timer = null;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      run().catch(() => {});
    };

    timer = setInterval(tick, poll);
    document.addEventListener("visibilitychange", tick);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [id, enabled, poll, run]);

  const data = snapshot?.data;
  const hasData = data !== undefined;

  return {
    data,
    error: snapshot?.error ?? null,
    isLoading: enabled && !hasData && !snapshot?.error,
    // True while refreshing with data already on screen - used for subtle
    // feedback instead of a full-page skeleton. `isStale` is set when a fetch
    // starts and cleared when it resolves, so it is the in-flight signal.
    isRefreshing: enabled && hasData && snapshot?.isStale === true,
    refetch: run,
    invalidate: () => invalidate(key),
  };
};

/**
 * Mutation hook.
 *
 * `invalidate` lists the query-key prefixes to refresh once the server has
 * confirmed success, so lists and dashboard counts update without a manual
 * refresh and without re-fetching unrelated endpoints.
 */
export const useMutation = (mutateFn, { invalidate: keys = [], onSuccess, onError } = {}) => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (...args) => {
      setIsPending(true);
      setError(null);
      try {
        const result = await mutateFn(...args);
        // Only refresh after the server confirmed the change.
        if (keys.length) invalidate(keys);
        if (mounted.current) onSuccess?.(result);
        return result;
      } catch (err) {
        if (mounted.current) {
          setError(err);
          onError?.(err);
        }
        throw err;
      } finally {
        if (mounted.current) setIsPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(keys)]
  );

  return { mutate, isPending, error, reset: () => setError(null) };
};

export { invalidate, markStale };