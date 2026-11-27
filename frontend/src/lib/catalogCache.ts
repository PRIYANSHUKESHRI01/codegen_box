import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface Entry<T> {
  tokenKey: string;
  value: T;
  fetchedAt: number;
}

const DEFAULT_TTL_MS = 60_000;
const IS_VITEST = typeof process !== "undefined" && Boolean(process.env?.VITEST);
const cache = new Map<string, Entry<unknown>>();

export function clearCatalogCache(key?: string) {
  if (key) {
    cache.delete(key);
    return;
  }
  cache.clear();
}

if (typeof window !== "undefined") {
  const clearAll = () => cache.clear();
  window.addEventListener("aptrun:stats-changed", clearAll);
  window.addEventListener("aptrun:modules-changed", clearAll);
  window.addEventListener("aptrun:subscription-changed", clearAll);
}

/**
 * Module-level cache for large read-heavy catalog GET responses (/problems,
 * /curated-interview-sets, /mock-interviews/catalog) so navigating back or
 * switching tabs renders immediately instead of re-downloading 0.5-1 MB payloads.
 */
export async function getCachedCatalog<T>(
  path: string,
  options: { ttlMs?: number; force?: boolean } = {}
): Promise<T> {
  const { ttlMs = DEFAULT_TTL_MS, force = false } = options;
  const tokenKey = getToken() ?? "anon";

  if (!IS_VITEST && !force) {
    const existing = cache.get(path) as Entry<T> | undefined;
    if (existing && existing.tokenKey === tokenKey && Date.now() - existing.fetchedAt < ttlMs) {
      return existing.value;
    }
  }

  const data = await api.get<T>(path);
  if (!IS_VITEST) {
    cache.set(path, { tokenKey, value: data, fetchedAt: Date.now() });
  }
  return data;
}
