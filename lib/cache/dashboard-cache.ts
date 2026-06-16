const cache = new Map<string, { value: unknown; expiresAt: number }>();
const DEFAULT_TTL_MS = 60_000;

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const value = await fetcher();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
