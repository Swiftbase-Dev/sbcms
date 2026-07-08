export class LRUCache<K, V> {
  private max: number;
  private cache: Map<K, V>;

  constructor(max = 20) {
    this.max = max;
    this.cache = new Map<K, V>();
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (item !== undefined) {
      // Refresh key order (move to end)
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  set(key: K, val: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      // Remove oldest (first item in Map keys)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, val);
  }

  clear(): void {
    this.cache.clear();
  }
}

const apiCache = new LRUCache<string, any>(30);

export async function cachedFetch(
  url: string,
  options?: RequestInit,
  forceRefresh = false,
  onUpdate?: (data: any) => void
) {
  const method = (options?.method || "GET").toUpperCase();
  const isGet = method === "GET";

  if (isGet && !forceRefresh) {
    const cachedData = apiCache.get(url);
    if (cachedData !== undefined) {
      if (onUpdate) {
        onUpdate(cachedData);
        // Fire background revalidation
        fetch(url, options)
          .then((res) => {
            if (res.ok) return res.json();
            throw new Error();
          })
          .then((newData) => {
            if (JSON.stringify(newData) !== JSON.stringify(cachedData)) {
              apiCache.set(url, newData);
              onUpdate(newData);
            }
          })
          .catch((err) => console.warn("Background revalidation failed:", err));
      }
      return cachedData;
    }
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  const data = await res.json();

  if (isGet) {
    apiCache.set(url, data);
    if (onUpdate) {
      onUpdate(data);
    }
  } else {
    // Invalidate cache on mutations (POST, PUT, DELETE)
    apiCache.clear();
  }

  return data;
}

export function invalidateCache() {
  apiCache.clear();
}
