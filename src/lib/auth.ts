import { cookies, headers } from "next/headers";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "mister-pachanga-secret-key-2026";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  nickname: string;
  role: string;
  avatarUrl?: string | null;
}

// Lightweight native HMAC-SHA256 JWT Implementation (Zero external dependency issues)
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

export function signToken(user: SessionUser): string {
  const safeAvatar = user.avatarUrl && !user.avatarUrl.startsWith("data:") ? user.avatarUrl : null;
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      nickname: user.nickname,
      role: user.role,
      avatarUrl: safeAvatar,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    })
  );

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): SessionUser | null {
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return null;

    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    if (signature !== expectedSignature) return null;

    const decoded = JSON.parse(base64UrlDecode(payload));
    if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) {
      return null;
    }

    return {
      id: decoded.id,
      email: decoded.email,
      fullName: decoded.fullName,
      nickname: decoded.nickname,
      role: decoded.role,
      avatarUrl: decoded.avatarUrl,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get("pachanga_token")?.value;

    if (cookieToken) {
      const user = verifyToken(cookieToken);
      if (user) return user;
    }

    const headerStore = await headers();
    const authHeader = headerStore.get("authorization") || headerStore.get("x-pachanga-token");
    if (authHeader) {
      const headerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (headerToken) {
        return verifyToken(headerToken);
      }
    }

    return null;
  } catch {
    return null;
  }
}
