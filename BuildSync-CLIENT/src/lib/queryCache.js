/**
 * BuildSync query cache.
 *
 * A small, dependency-free data-synchronisation layer built on the existing
 * Axios client. It exists because every page previously hand-rolled its own
 * fetch + useState + useEffect + manual Refresh button, which meant:
 *   - no de-duplication of in-flight requests,
 *   - no protection against a slow response overwriting a newer one,
 *   - no shared invalidation after a mutation,
 *   - a Refresh button on almost every page.
 *
 * Responsibilities:
 *   - de-duplicate concurrent requests for the same key
 *   - guard against stale responses overwriting newer data
 *   - broadcast cache changes to subscribed React components
 *   - invalidate by key prefix after a mutation
 *   - keep the last good data visible when a background refresh fails
 */

const CACHE = new Map();

export const serializeKey = (key) =>
  Array.isArray(key)
    ? key
        .map((part) =>
          part && typeof part === "object" ? JSON.stringify(part) : String(part)
        )
        .join("::")
    : String(key);

/** Returns the cached entry, creating an empty one if absent. */
const entryFor = (key) => {
  const id = serializeKey(key);
  let entry = CACHE.get(id);
  if (!entry) {
    entry = {
      id,
      key,
      data: undefined,
      error: null,
      // `undefined` data means "never fetched" -> treat as loading.
      fetchedAt: 0,
      promise: null,
      requestId: 0,
      subscribers: new Set(),
      isStale: true,
      // Immutable snapshot handed to React. It must be a NEW object whenever
      // state changes, because useSyncExternalStore re-renders only when the
      // snapshot identity changes - mutating the entry in place is invisible.
      snapshot: { data: undefined, error: null, isStale: true },
    };
    CACHE.set(id, entry);
  }
  return entry;
};

/**
 * Stable snapshot for `useSyncExternalStore`. The reference only changes when
 * data actually changes, so React does not re-render in a loop.
 */
export const getSnapshot = (key) => entryFor(key).snapshot;

/** Server snapshot for SSR-less usage. */
export const getServerSnapshot = () => null;

export const subscribe = (key, listener) => {
  const entry = entryFor(key);
  entry.subscribers.add(listener);
  return () => {
    entry.subscribers.delete(listener);
  };
};

const notify = (entry) => {
  // Publish a fresh snapshot object, then wake subscribers.
  entry.snapshot = {
    data: entry.data,
    error: entry.error,
    isStale: entry.isStale,
  };
  entry.subscribers.forEach((listener) => listener());
};

/**
 * Fetches `key`, sharing one in-flight request across all subscribers.
 *
 * @param key      stable cache key (string or array)
 * @param fetcher  async () => data
 * @param opts     { force, staleTime }
 */
export const fetchQuery = async (key, fetcher, { force = false, staleTime = 0 } = {}) => {
  const entry = entryFor(key);

  const isFresh = entry.fetchedAt > 0 && Date.now() - entry.fetchedAt < staleTime;
  if (!force && isFresh && entry.data !== undefined) return entry.data;

  // De-duplicate: a second caller joins the in-flight request.
  if (!force && entry.promise) return entry.promise;

  const requestId = ++entry.requestId;

const run = (async () => {
    entry.isStale = false;
    // Announce the in-flight state so subscribers can show subtle
    // "refreshing" feedback without unmounting existing content.
    notify(entry);
    try {
      const data = await fetcher();
      // Discard a response that has been superseded by a newer request.
      if (requestId !== entry.requestId) return entry.data;
      entry.data = data;
      entry.error = null;
      entry.fetchedAt = Date.now();
      // Announce the resolved state - this is what subscribers render.
      notify(entry);
      return data;
    } catch (error) {
      if (requestId !== entry.requestId) return entry.data;
      entry.error = error;
      entry.fetchedAt = Date.now();
      // Deliberately keep `entry.data` so a failed background refresh does not
      // wipe usable content.
      notify(entry);
      throw error;
    } finally {
      if (requestId === entry.requestId) entry.promise = null;
    }
  })();

  entry.promise = run;
  run.catch(() => {}); // handled by the caller; avoids unhandled rejection
  return run;
};

/**
 * Refetches the given key(s) if they have subscribers.
 * `prefix` matches the start of the serialised key, e.g. `["employees"]`.
 */
export const invalidate = (prefixes = [], { force = true } = {}) => {
  const wanted = (Array.isArray(prefixes) ? prefixes : [prefixes]).map(serializeKey);

  CACHE.forEach((entry) => {
    const matches = wanted.some((p) => entry.id === p || entry.id.startsWith(p + "::"));
    if (!matches) return;
    if (entry.subscribers.size === 0) {
      // Nobody is watching; just mark it stale for the next subscriber.
      entry.isStale = true;
      return;
    }
    if (entry.fetcher) {
      fetchQuery(entry.key, entry.fetcher, { force });
    }
  });
};

/** Registers the fetcher so `invalidate` can refetch without a subscriber call. */
export const registerFetcher = (key, fetcher) => {
  entryFor(key).fetcher = fetcher;
};

export const markStale = (key) => {
  const entry = entryFor(key);
  entry.isStale = true;
  entry.fetchedAt = 0;
};

export const isStale = (key) => {
  const e = CACHE.get(serializeKey(key));
  return !e || e.fetchedAt === 0;
};

/** Test helper - drops all cached data. */
export const __resetCache = () => CACHE.clear();

export const cacheSize = () => CACHE.size;