import { type PlatformType } from "@/lib/db/schema";

export const DEFAULT_TIMEOUT_MS = 15000;

export interface PlatformDeleteResult {
  targetId: string;
  platform: PlatformType;
  platformPostId?: string | null;
  success: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  alreadyDeleted?: boolean;
  needsReauth?: boolean;
  unsupported?: boolean;
  warning?: string;
}

export interface PlatformAdapter {
  platform: PlatformType;
  delete(
    targetId: string,
    platformPostId: string,
    accountOrToken: { platformAccountId?: string } | string,
    accessToken?: string,
    timeoutMs?: number
  ): Promise<PlatformDeleteResult>;
}

/**
 * Fetch wrapper dengan timeout via AbortController.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error: unknown) {
    const err = error as Error;
    if (err?.name === "AbortError") {
      const timeoutErr = new Error(`Request timeout after ${timeoutMs}ms`);
      timeoutErr.name = "TimeoutError";
      throw timeoutErr;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Helper untuk mengekstrak token dari parameter fleksibel.
 */
function resolveAccessToken(
  accountOrToken: { platformAccountId?: string } | string,
  accessToken?: string
): string {
  if (typeof accountOrToken === "string") {
    return accountOrToken;
  }
  return accessToken || "";
}

/**
 * Hapus postingan di Meta Facebook Page via Graph API v19.0:
 * DELETE /{platformPostId} dengan access token halaman terkait.
 */
export async function deleteFromMeta(
  targetId: string,
  platformPostId: string,
  accountOrToken: { platformAccountId?: string } | string,
  maybeAccessToken?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PlatformDeleteResult> {
  const token = resolveAccessToken(accountOrToken, maybeAccessToken);

  try {
    const url = `https://graph.facebook.com/v19.0/${platformPostId}?access_token=${encodeURIComponent(token)}`;
    const res = await fetchWithTimeout(url, { method: "DELETE" }, timeoutMs);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.error) {
      const err = json.error || {};
      const errorCode = String(err.code || res.status);
      const errorMessage = String(err.message || "Meta Facebook API error");

      // Cek apakah postingan sudah dihapus langsung dari Facebook oleh pengguna
      const isAlreadyDeleted =
        res.status === 404 ||
        errorCode === "24" ||
        errorCode === "803" ||
        (errorCode === "100" &&
          (errorMessage.toLowerCase().includes("does not exist") ||
            errorMessage.toLowerCase().includes("unsupported delete request") ||
            errorMessage.toLowerCase().includes("cannot be loaded")));

      if (isAlreadyDeleted) {
        return {
          targetId,
          platform: "META_PAGE",
          platformPostId,
          success: true,
          alreadyDeleted: true,
          errorMessage: "Postingan sudah dihapus sebelumnya dari Facebook.",
        };
      }

      const isAuthError =
        err.type === "OAuthException" ||
        errorCode === "190" ||
        err.error_subcode === 463 ||
        err.error_subcode === 467 ||
        res.status === 401;

      return {
        targetId,
        platform: "META_PAGE",
        platformPostId,
        success: false,
        errorCode: isAuthError ? "TOKEN_EXPIRED" : errorCode,
        errorMessage,
        needsReauth: isAuthError,
      };
    }

    return {
      targetId,
      platform: "META_PAGE",
      platformPostId,
      success: true,
    };
  } catch (error: unknown) {
    const err = error as Error;
    const isTimeout = err?.name === "TimeoutError";
    return {
      targetId,
      platform: "META_PAGE",
      platformPostId,
      success: false,
      errorCode: isTimeout ? "TIMEOUT" : "FETCH_ERROR",
      errorMessage: err?.message || "Gagal menghubungi server Meta Facebook",
    };
  }
}

/**
 * Hapus postingan di Instagram Business via Instagram Graph API:
 * DELETE /{platformPostId} dengan access token terkait.
 */
export async function deleteFromInstagram(
  targetId: string,
  platformPostId: string,
  accountOrToken: { platformAccountId?: string } | string,
  maybeAccessToken?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PlatformDeleteResult> {
  const token = resolveAccessToken(accountOrToken, maybeAccessToken);

  try {
    const url = `https://graph.facebook.com/v19.0/${platformPostId}?access_token=${encodeURIComponent(token)}`;
    const res = await fetchWithTimeout(url, { method: "DELETE" }, timeoutMs);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.error) {
      const err = json.error || {};
      const errorCode = String(err.code || res.status);
      const errorMessage = String(err.message || "Instagram API error");

      const isAlreadyDeleted =
        res.status === 404 ||
        errorCode === "24" ||
        errorCode === "803" ||
        (errorCode === "100" &&
          (errorMessage.toLowerCase().includes("does not exist") ||
            errorMessage.toLowerCase().includes("unsupported delete request") ||
            errorMessage.toLowerCase().includes("cannot be loaded")));

      if (isAlreadyDeleted) {
        return {
          targetId,
          platform: "INSTAGRAM",
          platformPostId,
          success: true,
          alreadyDeleted: true,
          errorMessage: "Postingan sudah dihapus sebelumnya dari Instagram.",
        };
      }

      const isAuthError =
        err.type === "OAuthException" ||
        errorCode === "190" ||
        err.error_subcode === 463 ||
        err.error_subcode === 467 ||
        res.status === 401;

      return {
        targetId,
        platform: "INSTAGRAM",
        platformPostId,
        success: false,
        errorCode: isAuthError ? "TOKEN_EXPIRED" : errorCode,
        errorMessage,
        needsReauth: isAuthError,
      };
    }

    return {
      targetId,
      platform: "INSTAGRAM",
      platformPostId,
      success: true,
    };
  } catch (error: unknown) {
    const err = error as Error;
    const isTimeout = err?.name === "TimeoutError";
    return {
      targetId,
      platform: "INSTAGRAM",
      platformPostId,
      success: false,
      errorCode: isTimeout ? "TIMEOUT" : "FETCH_ERROR",
      errorMessage: err?.message || "Gagal menghubungi server Instagram",
    };
  }
}

/**
 * Hapus postingan di Threads via Threads API:
 * DELETE /{threadsMediaId} dengan access token terkait.
 */
export async function deleteFromThreads(
  targetId: string,
  platformPostId: string,
  accountOrToken: { platformAccountId?: string } | string,
  maybeAccessToken?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PlatformDeleteResult> {
  const token = resolveAccessToken(accountOrToken, maybeAccessToken);

  try {
    const url = `https://graph.threads.net/v1.0/${platformPostId}?access_token=${encodeURIComponent(token)}`;
    const res = await fetchWithTimeout(url, { method: "DELETE" }, timeoutMs);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.error) {
      const err = json.error || {};
      const errorCode = String(err.code || res.status);
      const errorMessage = String(err.message || "Threads API error");

      const isAlreadyDeleted =
        res.status === 404 ||
        errorCode === "24" ||
        (errorCode === "100" &&
          (errorMessage.toLowerCase().includes("does not exist") ||
            errorMessage.toLowerCase().includes("not found")));

      if (isAlreadyDeleted) {
        return {
          targetId,
          platform: "THREADS",
          platformPostId,
          success: true,
          alreadyDeleted: true,
          errorMessage: "Postingan sudah dihapus sebelumnya dari Threads.",
        };
      }

      const isAuthError =
        err.type === "OAuthException" || errorCode === "190" || res.status === 401;

      return {
        targetId,
        platform: "THREADS",
        platformPostId,
        success: false,
        errorCode: isAuthError ? "TOKEN_EXPIRED" : errorCode,
        errorMessage,
        needsReauth: isAuthError,
      };
    }

    return {
      targetId,
      platform: "THREADS",
      platformPostId,
      success: true,
    };
  } catch (error: unknown) {
    const err = error as Error;
    const isTimeout = err?.name === "TimeoutError";
    return {
      targetId,
      platform: "THREADS",
      platformPostId,
      success: false,
      errorCode: isTimeout ? "TIMEOUT" : "FETCH_ERROR",
      errorMessage: err?.message || "Gagal menghubungi server Threads",
    };
  }
}

/**
 * Hapus postingan di TikTok via TikTok Content Posting API:
 * Terintegrasi dengan endpoint DELETE dan penanganan pembatasan API TikTok.
 */
export async function deleteFromTikTok(
  targetId: string,
  platformPostId: string,
  accountOrToken: { platformAccountId?: string } | string,
  maybeAccessToken?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PlatformDeleteResult> {
  const token = resolveAccessToken(accountOrToken, maybeAccessToken);

  try {
    const url = `https://open.tiktokapis.com/v2/post/publish/video/${platformPostId}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      },
      timeoutMs
    );

    const json = await res.json().catch(() => ({}));

    if (!res.ok || (json.error && json.error.code !== "ok" && json.error.code !== 0)) {
      const err = json.error || {};
      const errorCode = String(err.code || res.status);
      const errorMessage = String(err.message || "TikTok API error");

      // Cek apakah video sudah dihapus atau tidak ditemukan
      const isAlreadyDeleted =
        res.status === 404 ||
        errorCode === "video_not_found" ||
        errorCode === "publish_id_not_found" ||
        errorMessage.toLowerCase().includes("not found") ||
        errorMessage.toLowerCase().includes("does not exist");

      if (isAlreadyDeleted) {
        return {
          targetId,
          platform: "TIKTOK",
          platformPostId,
          success: true,
          alreadyDeleted: true,
          errorMessage: "Postingan sudah dihapus sebelumnya dari TikTok.",
        };
      }

      // Cek pembatasan API / izin terkait pada TikTok Content Posting API
      const isUnsupported =
        res.status === 405 ||
        errorCode === "unsupported_action" ||
        errorCode === "scope_not_authorized" ||
        errorMessage.toLowerCase().includes("not support");

      if (isUnsupported) {
        return {
          targetId,
          platform: "TIKTOK",
          platformPostId,
          success: true,
          unsupported: true,
          warning:
            "TikTok Content Posting API saat ini belum mendukung penghapusan video terbit secara otomatis. Silakan hapus video langsung di aplikasi TikTok.",
        };
      }

      const isAuthError = res.status === 401 || errorCode === "access_token_invalid";

      return {
        targetId,
        platform: "TIKTOK",
        platformPostId,
        success: false,
        errorCode: isAuthError ? "TOKEN_EXPIRED" : errorCode,
        errorMessage,
        needsReauth: isAuthError,
      };
    }

    return {
      targetId,
      platform: "TIKTOK",
      platformPostId,
      success: true,
    };
  } catch (error: unknown) {
    const err = error as Error;
    const isTimeout = err?.name === "TimeoutError";
    return {
      targetId,
      platform: "TIKTOK",
      platformPostId,
      success: false,
      errorCode: isTimeout ? "TIMEOUT" : "FETCH_ERROR",
      errorMessage: err?.message || "Gagal menghubungi server TikTok",
    };
  }
}

// ==========================================
// Platform Adapter Instances & Registry
// ==========================================

export const metaAdapter: PlatformAdapter = {
  platform: "META_PAGE",
  delete: deleteFromMeta,
};

export const facebookAdapter: PlatformAdapter = metaAdapter;

export const instagramAdapter: PlatformAdapter = {
  platform: "INSTAGRAM",
  delete: deleteFromInstagram,
};

export const threadsAdapter: PlatformAdapter = {
  platform: "THREADS",
  delete: deleteFromThreads,
};

export const tiktokAdapter: PlatformAdapter = {
  platform: "TIKTOK",
  delete: deleteFromTikTok,
};

export const platformAdapters: Record<PlatformType, PlatformAdapter> = {
  META_PAGE: metaAdapter,
  INSTAGRAM: instagramAdapter,
  THREADS: threadsAdapter,
  TIKTOK: tiktokAdapter,
};

/**
 * Eksekusi penghapusan target platform secara terpadu melalui adapter yang sesuai.
 */
export async function deleteFromPlatform(
  platform: PlatformType,
  targetId: string,
  platformPostId: string,
  accountOrToken: { platformAccountId?: string } | string,
  accessToken?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PlatformDeleteResult> {
  const adapter = platformAdapters[platform];
  if (!adapter) {
    return {
      targetId,
      platform,
      platformPostId,
      success: false,
      errorCode: "UNSUPPORTED_PLATFORM",
      errorMessage: `Platform ${platform} belum didukung untuk penghapusan.`,
    };
  }

  return adapter.delete(targetId, platformPostId, accountOrToken, accessToken, timeoutMs);
}
