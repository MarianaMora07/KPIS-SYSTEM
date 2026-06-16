const buckets = new Map<string, { count: number; resetAt: number }>();

const MAX_REQUESTS = 10;
const WINDOW_MS = 60_000;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) return false;

  entry.count++;
  return true;
}
