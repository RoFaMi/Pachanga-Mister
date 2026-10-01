export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("pachanga_token") : null;
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization") && !headers.has("authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

export async function safeFetchJson<T = any>(url: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const res = await authFetch(url, options);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || !text.trim()) return null;
    const data = JSON.parse(text) as T;
    if (data && typeof data === "object" && (data as any).user && typeof window !== "undefined") {
      try {
        localStorage.setItem("pachanga_user", JSON.stringify((data as any).user));
      } catch (e) {}
    }
    return data;
  } catch (e) {
    console.error(`Fetch JSON error for ${url}:`, e);
    return null;
  }
}
