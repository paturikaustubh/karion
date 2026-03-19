const TTL = 30 * 1000; // 30 seconds

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateTask(taskId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`activity:${taskId}:`)) {
      cache.delete(key);
    }
  }
}
