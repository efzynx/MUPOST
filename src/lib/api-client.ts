import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/cookies";
import { invalidatePostsCache } from "@/lib/pwa-cache";

/**
 * Mengambil nilai cookie tertentu dari document.cookie di sisi browser.
 */
export function getClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match && match[3] ? decodeURIComponent(match[3]) : null;
}

/**
 * Fetch wrapper yang secara otomatis melampirkan header X-CSRF-Token
 * untuk setiap mutating request (POST, PUT, PATCH, DELETE).
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfToken = getClientCookie(CSRF_COOKIE_NAME);
    if (csrfToken && !headers.has(CSRF_HEADER_NAME)) {
      headers.set(CSRF_HEADER_NAME, csrfToken);
    }
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: T;
  try {
    data = await response.json();
  } catch {
    data = {} as T;
  }

  // Otomatis invalidasi cache posts saat mutasi (POST, PUT, PATCH, DELETE) pada /api/posts berhasil
  if (response.ok && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    if (url.includes("/api/posts")) {
      invalidatePostsCache().catch(() => {});
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
