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
  let res = await fetch(url, { ...options, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("pachanga_token");
    token = await ensureAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      res = await fetch(url, { ...options, headers });
    }
  }
  return res;
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
