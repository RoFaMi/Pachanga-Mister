// --- Egress & Client Data Caching System ---

interface CacheEntry {
  data: any;
  timestamp: number;
  ttlMs: number;
  byteLength: number;
}

const apiCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<any>>();

// Telemetry metrics
let cacheHits = 0;
let cacheMisses = 0;
let bytesSavedTotal = 0;
let totalBytesTransferred = 0;

export function getEgressMetrics() {
  const totalRequests = cacheHits + cacheMisses;
  const hitRatioPercent = totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(1) : "0.0";
  return {
    cacheHits,
    cacheMisses,
    totalRequests,
    hitRatioPercent: `${hitRatioPercent}%`,
    bytesSavedTotal,
    bytesSavedKb: (bytesSavedTotal / 1024).toFixed(1) + " KB",
    totalBytesTransferred,
    totalBytesTransferredKb: (totalBytesTransferred / 1024).toFixed(1) + " KB",
  };
}

export function invalidateApiCache(pattern?: string | RegExp) {
  if (!pattern) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (typeof pattern === "string" ? key.includes(pattern) : pattern.test(key)) {
      apiCache.delete(key);
    }
  }
}

export async function ensureAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  let token = localStorage.getItem("pachanga_token");
  if (token) return token;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@pachanga.com", password: "pachanga123" }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.token) {
      localStorage.setItem("pachanga_token", data.token);
      if (data.user) {
        localStorage.setItem("pachanga_user", JSON.stringify(data.user));
      }
      return data.token;
    }
  } catch (e) {
    console.error("Auto-login error in ensureAuthToken:", e);
  }
  return null;
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = typeof window !== "undefined" ? localStorage.getItem("pachanga_token") : null;
  if (!token && typeof window !== "undefined") {
    token = await ensureAuthToken();
  }
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization") && !headers.has("authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const method = (options.method || "GET").toUpperCase();
  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("pachanga_token");
    token = await ensureAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      res = await fetch(url, { ...options, headers });
    }
  }

  // Auto-invalidate GET cache on state-changing operations
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method) && res.ok) {
    invalidateApiCache();
  }

  return res;
}

export interface FetchOptions extends RequestInit {
  skipCache?: boolean;
  ttlMs?: number;
}

export async function safeFetchJson<T = any>(url: string, options: FetchOptions = {}): Promise<T | null> {
  const method = (options.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const { skipCache = false, ttlMs = 30000, ...fetchInit } = options;

  // 1. Check in-memory cache for GET requests
  if (isGet && !skipCache) {
    const cached = apiCache.get(url);
    if (cached) {
      const isFresh = Date.now() - cached.timestamp < cached.ttlMs;
      if (isFresh) {
        cacheHits++;
        bytesSavedTotal += cached.byteLength;
        return cached.data as T;
      }
    }
  }

  // 2. Request deduplication for identical concurrent GET requests
  if (isGet && pendingRequests.has(url)) {
    cacheHits++;
    return pendingRequests.get(url) as Promise<T | null>;
  }

  const fetchPromise = (async () => {
    try {
      cacheMisses++;
      const res = await authFetch(url, fetchInit);
      if (!res.ok) return null;
      const text = await res.text();
      if (!text || !text.trim()) return null;

      const byteLength = new Blob([text]).size;
      totalBytesTransferred += byteLength;

      const data = JSON.parse(text) as T;

      if (data && typeof data === "object" && (data as any).user && typeof window !== "undefined") {
        try {
          localStorage.setItem("pachanga_user", JSON.stringify((data as any).user));
        } catch (e) {}
      }

      // Store in GET cache
      if (isGet && !skipCache) {
        apiCache.set(url, {
          data,
          timestamp: Date.now(),
          ttlMs,
          byteLength,
        });
      }

      return data;
    } catch (e) {
      console.error(`Fetch JSON error for ${url}:`, e);
      return null;
    } finally {
      if (isGet) {
        pendingRequests.delete(url);
      }
    }
  })();

  if (isGet) {
    pendingRequests.set(url, fetchPromise);
  }

  return fetchPromise;
}
