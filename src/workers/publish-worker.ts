import { Worker, type Job } from "bullmq";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts, postTargets, connectedAccounts, type PlatformType } from "@/lib/db/schema";
import { getRedisClient } from "@/lib/redis";
import { PUBLISH_QUEUE_NAME, type PublishJobData } from "@/lib/queue/publish-queue";
import { decrypt } from "@/lib/crypto";
import { publishPostEvent } from "@/lib/services/post-events";

// ==========================================
// Types
// ==========================================

export interface PlatformPublishResult {
  targetId: string;
  platform: PlatformType;
  success: boolean;
  platformPostId?: string;
  publishedAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  needsReauth?: boolean;
}

export interface PublishExecutionResult {
  postId: string;
  postStatus: "PUBLISHED" | "PARTIAL" | "FAILED";
  results: PlatformPublishResult[];
}

export interface InstagramPublishOptions {
  pollIntervalMs?: number;
  maxPolls?: number;
  publishRetryDelayMs?: number;
  maxPublishAttempts?: number;
}

interface MetaApiError {
  message?: string;
  type?: string;
  code?: number | string;
  error_subcode?: number;
}

interface MetaApiResponse {
  id?: string;
  post_id?: string;
  status_code?: string;
  status?: string;
  error_message?: string;
  error?: MetaApiError;
}

const DEFAULT_TIMEOUT_MS = 30_000; // 30 detik (Requirement 11.7)

// ==========================================
// Helper Fetch with Timeout
// ==========================================

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === "AbortError" || controller.signal.aborted) {
      const timeoutErr = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutErr.name = "TimeoutError";
      throw timeoutErr;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ==========================================
// Platform Publisher & Deletion Implementations
// ==========================================

export {
  deleteFromMeta,
  deleteFromInstagram,
  deleteFromThreads,
  deleteFromTikTok,
  deleteFromPlatform,
  platformAdapters,
  metaAdapter,
  facebookAdapter,
  instagramAdapter,
  threadsAdapter,
  tiktokAdapter,
  type PlatformDeleteResult,
  type PlatformAdapter,
} from "@/lib/services/platform-adapters";

/**
 * Publikasi ke Meta Facebook Page via Meta Graph API v19.0
 * - Teks saja: POST /{page_id}/feed
 * - Dengan gambar: POST /{page_id}/photos
 * - Dengan video: POST /{page_id}/videos
 */
export async function publishToMeta(
  targetId: string,
  post: { textContent: string; mediaUrls?: string[] | null },
  account: { platformAccountId: string },
  accessToken: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PlatformPublishResult> {
  const pageId = account.platformAccountId;
  const firstMedia = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : null;
  const isVideo = firstMedia?.match(/\.(mp4|mov|webm)$/i);

  try {
    let url: string;
    const bodyParams = new URLSearchParams();
    bodyParams.append("access_token", accessToken);

    if (firstMedia) {
      if (isVideo) {
        url = `https://graph.facebook.com/v19.0/${pageId}/videos`;
        bodyParams.append("file_url", firstMedia);
        bodyParams.append("description", post.textContent);
      } else {
        url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
        bodyParams.append("url", firstMedia);
        bodyParams.append("caption", post.textContent);
      }
    } else {
      url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
      bodyParams.append("message", post.textContent);
    }

    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: bodyParams.toString(),
      },
      timeoutMs
    );

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.error) {
      const err = json.error || {};
      const errorCode = String(err.code || res.status);
      const errorMessage = err.message || "Meta API error";
      const isAuthError =
        err.type === "OAuthException" ||
        errorCode === "190" ||
        err.error_subcode === 463 ||
        err.error_subcode === 467 ||
        res.status === 401;

      return {
        targetId,
        platform: "META_PAGE",
        success: false,
        errorCode,
        errorMessage,
        needsReauth: isAuthError,
      };
    }

    const platformPostId = json.id || json.post_id;
    return {
      targetId,
      platform: "META_PAGE",
      success: true,
      platformPostId,
      publishedAt: new Date(),
    };
  } catch (error: any) {
    const isTimeout = error.name === "TimeoutError";
    return {
      targetId,
      platform: "META_PAGE",
      success: false,
      errorCode: isTimeout ? "TIMEOUT" : "FETCH_ERROR",
      errorMessage: error.message || "Gagal menghubungi server Meta",
    };
  }
}

/**
 * Publikasi ke Instagram Business via Instagram Graph API (Two-step flow)
 * - Langkah 1: POST /{ig_user_id}/media (buat container)
 * - Langkah 2: Polling status container (untuk video/Reels) hingga status bernilai FINISHED
 * - Langkah 3: POST /{ig_user_id}/media_publish (publikasikan container dengan retry)
 */
export async function publishToInstagram(
  targetId: string,
  post: { textContent: string; mediaUrls?: string[] | null },
  account: { platformAccountId: string },
  accessToken: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  options?: InstagramPublishOptions
): Promise<PlatformPublishResult> {
  const igUserId = account.platformAccountId;
  const firstMedia = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : null;

  if (!firstMedia) {
    return {
      targetId,
      platform: "INSTAGRAM",
      success: false,
      errorCode: "MISSING_MEDIA",
      errorMessage: "Instagram memerlukan media (gambar atau video) untuk dipublikasikan.",
    };
  }

  const isVideo = Boolean(firstMedia.match(/\.(mp4|mov|webm)($|\?)/i));

  try {
    // Step 1: Create Container
    const containerParams = new URLSearchParams();
    containerParams.append("access_token", accessToken);
    containerParams.append("caption", post.textContent);

    if (isVideo) {
      containerParams.append("video_url", firstMedia);
      containerParams.append("media_type", "REELS");
    } else {
      containerParams.append("image_url", firstMedia);
    }

    const containerRes = await fetchWithTimeout(
      `https://graph.facebook.com/v19.0/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: containerParams.toString(),
      },
      timeoutMs
    );

    const containerJson: MetaApiResponse = await containerRes.json().catch(() => ({}));

    if (!containerRes.ok || containerJson.error) {
      const err = containerJson.error || {};
      const errorCode = String(err.code || containerRes.status);
      const isAuthError =
        err.type === "OAuthException" ||
        errorCode === "190" ||
        err.error_subcode === 463 ||
        containerRes.status === 401;

      return {
        targetId,
        platform: "INSTAGRAM",
        success: false,
        errorCode,
        errorMessage: err.message || "Gagal membuat Instagram container",
        needsReauth: isAuthError,
      };
    }

    const creationId = containerJson.id;
    if (!creationId) {
      return {
        targetId,
        platform: "INSTAGRAM",
        success: false,
        errorCode: "INVALID_CONTAINER_RESPONSE",
        errorMessage: "Respon pembuatan container Instagram tidak mengembalikan creation ID.",
      };
    }

    // Untuk video/Reels, Instagram Graph API memproses media secara asinkron.
    // Jika media_publish dipanggil sebelum container berstatus "FINISHED",
    // Instagram mengembalikan error 9007: "Media ID is not available".
    if (isVideo) {
      const maxPolls = options?.maxPolls ?? 20; // Default polling hingga 40 detik (20 x 2 detik)
      const pollIntervalMs = options?.pollIntervalMs ?? 2000;
      let isReady = false;

      for (let poll = 0; poll < maxPolls; poll++) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

        try {
          const statusRes = await fetchWithTimeout(
            `https://graph.facebook.com/v19.0/${creationId}?fields=status_code&access_token=${accessToken}`,
            { method: "GET" },
            10000
          );

          if (statusRes.ok) {
            const statusData: MetaApiResponse = await statusRes.json().catch(() => ({}));
            if (statusData.status_code === "FINISHED") {
              isReady = true;
              break;
            } else if (statusData.status_code === "ERROR") {
              return {
                targetId,
                platform: "INSTAGRAM",
                success: false,
                errorCode: "CONTAINER_PROCESSING_FAILED",
                errorMessage:
                  statusData.error_message ||
                  statusData.status ||
                  "Pemrosesan media video di server Instagram gagal.",
              };
            } else if (statusData.status_code === "EXPIRED") {
              return {
                targetId,
                platform: "INSTAGRAM",
                success: false,
                errorCode: "CONTAINER_EXPIRED",
                errorMessage: "Container video Instagram kedaluwarsa sebelum dapat dipublikasikan.",
              };
            }
          } else {
            const statusData: MetaApiResponse = await statusRes.json().catch(() => ({}));
            if (statusData.error) {
              const err = statusData.error;
              const isAuthError =
                err.type === "OAuthException" ||
                String(err.code) === "190" ||
                err.error_subcode === 463 ||
                statusRes.status === 401;

              if (isAuthError) {
                return {
                  targetId,
                  platform: "INSTAGRAM",
                  success: false,
                  errorCode: String(err.code || statusRes.status),
                  errorMessage:
                    err.message ||
                    "Autentikasi Instagram tidak valid saat polling status container.",
                  needsReauth: true,
                };
              }
            }
          }
        } catch {
          // Lanjutkan polling jika terjadi kegagalan jaringan sementara
        }
      }

      if (!isReady) {
        return {
          targetId,
          platform: "INSTAGRAM",
          success: false,
          errorCode: "CONTAINER_TIMEOUT",
          errorMessage: "Batas waktu pemrosesan media video di server Instagram terlampaui.",
        };
      }
    }

    // Step 2: Publish Container (dengan retry jika ada replikasi / delay sementara)
    const publishParams = new URLSearchParams();
    publishParams.append("access_token", accessToken);
    publishParams.append("creation_id", creationId);

    let publishRes: Response | null = null;
    let publishJson: MetaApiResponse = {};
    const maxPublishAttempts = options?.maxPublishAttempts ?? 3;
    const publishRetryDelayMs = options?.publishRetryDelayMs ?? 3000;

    for (let pAttempt = 0; pAttempt < maxPublishAttempts; pAttempt++) {
      publishRes = await fetchWithTimeout(
        `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: publishParams.toString(),
        },
        timeoutMs
      );

      publishJson = await publishRes.json().catch(() => ({}));

      if (publishRes.ok && !publishJson.error) {
        break;
      }

      const err = publishJson.error || {};
      const errCode = String(err.code || "");
      const errMsg = String(err.message || "");

      // Error 9007 ("Media ID is not available"), subcode 2207027 ("The media is not ready for publishing..."),
      // atau error 24 dapat terjadi jika container belum sepenuhnya tereplikasi di infrastruktur Meta
      const isMediaNotReady =
        errCode === "9007" ||
        errCode === "24" ||
        err.error_subcode === 2207027 ||
        errMsg.toLowerCase().includes("media id is not available") ||
        errMsg.toLowerCase().includes("not ready");

      if (isMediaNotReady && pAttempt < maxPublishAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, publishRetryDelayMs));
        continue;
      }

      break;
    }

    if (!publishRes || !publishRes.ok || publishJson.error) {
      const err = publishJson.error || {};
      const errorCode = String(err.code || publishRes?.status || "PUBLISH_FAILED");
      const isAuthError =
        err.type === "OAuthException" ||
        errorCode === "190" ||
        err.error_subcode === 463 ||
        publishRes?.status === 401;

      return {
        targetId,
        platform: "INSTAGRAM",
        success: false,
        errorCode,
        errorMessage: err.message || "Gagal mempublikasikan Instagram container",
        needsReauth: isAuthError,
      };
    }

    return {
      targetId,
      platform: "INSTAGRAM",
      success: true,
      platformPostId: publishJson.id,
      publishedAt: new Date(),
    };
  } catch (error: unknown) {
    const isError = error instanceof Error;
    const isTimeout = isError && error.name === "TimeoutError";
    const errorMessage = isError ? error.message : "Gagal menghubungi server Instagram";
    return {
      targetId,
      platform: "INSTAGRAM",
      success: false,
      errorCode: isTimeout ? "TIMEOUT" : "FETCH_ERROR",
      errorMessage,
    };
  }
}

/**
 * Publikasi ke TikTok via TikTok Content Posting API v2
 * - POST /v2/post/publish/video/init/ (PULL_FROM_URL)
 */
export async function publishToTikTok(
  targetId: string,
  post: { textContent: string; mediaUrls?: string[] | null },
  _account: { platformAccountId: string },
  accessToken: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PlatformPublishResult> {
  const firstMedia = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : null;

  if (!firstMedia) {
    return {
      targetId,
      platform: "TIKTOK",
      success: false,
      errorCode: "MISSING_MEDIA",
      errorMessage: "TikTok memerlukan file video untuk dapat dipublikasikan.",
    };
  }

  const isPhoto = !firstMedia.match(/\.(mp4|mov|webm)$/i);

  try {
    const isLocalDev = process.env.NODE_ENV !== "production";
    const privacyLevel = isLocalDev ? "SELF_ONLY" : "PUBLIC_TO_EVERYONE";

    const endpoint = isPhoto
      ? "https://open.tiktokapis.com/v2/post/publish/content/init/"
      : "https://open.tiktokapis.com/v2/post/publish/video/init/";

    const body: any = isPhoto
      ? {
          post_mode: "DIRECT_POST",
          media_type: "PHOTO",
          post_info: {
            title: post.textContent.slice(0, 90),
            description: post.textContent,
            privacy_level: privacyLevel,
          },
          source_info: {
            source: "PULL_FROM_URL",
            photo_images: [firstMedia],
            photo_cover_index: 0,
          },
        }
      : {
          post_info: {
            title: post.textContent,
            privacy_level: privacyLevel,
            disable_duet: false,
            disable_stitch: false,
            disable_comment: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: firstMedia,
          },
        };

    let res = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify(body),
      },
      timeoutMs
    );

    let json = await res.json().catch(() => ({}));

    // Fallback: Jika app belum diaudit oleh TikTok, API menolak public post
    // Kita coba fallback sekali dengan privacy_level = SELF_ONLY
    if (
      json.error &&
      json.error.code === "unaudited_client_can_only_post_to_private_accounts" &&
      privacyLevel !== "SELF_ONLY"
    ) {
      body.post_info.privacy_level = "SELF_ONLY";
      res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: JSON.stringify(body),
        },
        timeoutMs
      );
      json = await res.json().catch(() => ({}));
    }

    if (!res.ok || (json.error && json.error.code !== "ok" && json.error.code !== 0)) {
      const err = json.error || {};
      const errorCode = String(err.code || res.status);
      const isAuthError =
        res.status === 401 ||
        errorCode === "access_token_invalid" ||
        errorCode === "scope_not_authorized";

      return {
        targetId,
        platform: "TIKTOK",
        success: false,
        errorCode,
        errorMessage: err.message || "TikTok API error",
        needsReauth: isAuthError,
      };
    }

    const platformPostId = json.data?.publish_id || "tiktok_published";
    return {
      targetId,
      platform: "TIKTOK",
      success: true,
      platformPostId,
      publishedAt: new Date(),
    };
  } catch (error: any) {
    const isTimeout = error.name === "TimeoutError";
    return {
      targetId,
      platform: "TIKTOK",
      success: false,
      errorCode: isTimeout ? "TIMEOUT" : "FETCH_ERROR",
      errorMessage: error.message || "Gagal menghubungi server TikTok",
    };
  }
}

/**
 * Publikasi ke Meta Threads via Threads Graph API (Two-step flow)
 * - Langkah 1: POST /{threads_user_id}/threads (buat container)
 * - Langkah 2: POST /{threads_user_id}/threads_publish (publikasikan container)
 */
export async function publishToThreads(
  targetId: string,
  post: { textContent: string; mediaUrls?: string[] | null },
  account: { platformAccountId: string },
  accessToken: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PlatformPublishResult> {
  const threadsUserId = account.platformAccountId;
  const firstMedia = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : null;
  const isVideo = firstMedia ? Boolean(firstMedia.match(/\.(mp4|mov|webm)$/i)) : false;

  try {
    // Step 1: Create Container
    const containerParams = new URLSearchParams();
    containerParams.append("access_token", accessToken);
    containerParams.append("text", post.textContent);

    if (firstMedia) {
      if (isVideo) {
        containerParams.append("media_type", "VIDEO");
        containerParams.append("video_url", firstMedia);
      } else {
        containerParams.append("media_type", "IMAGE");
        containerParams.append("image_url", firstMedia);
      }
    } else {
      containerParams.append("media_type", "TEXT");
    }

    const containerRes = await fetchWithTimeout(
      `https://graph.threads.net/v1.0/${threadsUserId}/threads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: containerParams.toString(),
      },
      timeoutMs
    );

    const containerJson = await containerRes.json().catch(() => ({}));

    if (!containerRes.ok || containerJson.error) {
      const err = containerJson.error || {};
      const errorCode = String(err.code || containerRes.status);
      const isAuthError =
        err.type === "OAuthException" || errorCode === "190" || containerRes.status === 401;

      return {
        targetId,
        platform: "THREADS",
        success: false,
        errorCode,
        errorMessage: err.message || "Gagal membuat Threads container",
        needsReauth: isAuthError,
      };
    }

    const creationId = containerJson.id;

    // Untuk video, Meta Threads memproses media secara asinkron.
    // Jika threads_publish dipanggil sebelum container berstatus "FINISHED",
    // Threads mengembalikan error 24: "The requested resource does not exist".
    if (isVideo) {
      const maxPolls = 15; // Polling hingga 30 detik (15 x 2 detik)
      for (let poll = 0; poll < maxPolls; poll++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          const statusRes = await fetchWithTimeout(
            `https://graph.threads.net/v1.0/${creationId}?fields=status,error_message&access_token=${accessToken}`,
            { method: "GET" },
            10000
          );

          if (statusRes.ok) {
            const statusData = await statusRes.json().catch(() => ({}));
            if (statusData.status === "FINISHED") {
              break;
            } else if (statusData.status === "ERROR") {
              return {
                targetId,
                platform: "THREADS",
                success: false,
                errorCode: "CONTAINER_PROCESSING_FAILED",
                errorMessage:
                  statusData.error_message || "Pemrosesan media video di server Threads gagal.",
              };
            }
          }
        } catch {
          // Lanjutkan polling jika satu kali request gagal
        }
      }
    }

    // Step 2: Publish Container (dengan retry jika menerima error 24 / keterlambatan replikasi Meta)
    const publishParams = new URLSearchParams();
    publishParams.append("access_token", accessToken);
    publishParams.append("creation_id", creationId);

    let publishRes: Response | null = null;
    let publishJson: any = {};
    const maxPublishAttempts = 3;

    for (let pAttempt = 0; pAttempt < maxPublishAttempts; pAttempt++) {
      publishRes = await fetchWithTimeout(
        `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: publishParams.toString(),
        },
        timeoutMs
      );

      publishJson = await publishRes.json().catch(() => ({}));

      if (publishRes.ok && !publishJson.error) {
        break;
      }

      const err = publishJson.error || {};
      const errCode = String(err.code || publishRes.status);

      // Error 24 ("The requested resource does not exist") dapat terjadi jika kontainer belum siap
      if (errCode === "24" && pAttempt < maxPublishAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      break;
    }

    if (!publishRes || !publishRes.ok || publishJson.error) {
      const err = publishJson?.error || {};
      return {
        targetId,
        platform: "THREADS",
        success: false,
        errorCode: String(err.code || publishRes?.status || "UNKNOWN"),
        errorMessage: err.message || "Gagal mempublikasikan Threads container",
      };
    }

    return {
      targetId,
      platform: "THREADS",
      success: true,
      platformPostId: publishJson.id,
      publishedAt: new Date(),
    };
  } catch (error: any) {
    const isTimeout = error.name === "TimeoutError";
    return {
      targetId,
      platform: "THREADS",
      success: false,
      errorCode: isTimeout ? "TIMEOUT" : "FETCH_ERROR",
      errorMessage: error.message || "Gagal menghubungi server Threads",
    };
  }
}

// ==========================================
// Core Job Processor
// ==========================================

/**
 * Memproses job publikasi dari BullMQ `publish-queue`.
 * 1. Ambil record post beserta targetnya dari database.
 * 2. Ambil token akses tiap connected_account dan dekripsi.
 * 3. Eksekusi publikasi paralel via Promise.allSettled().
 * 4. Update status per post_target dan tentukan status final post (PUBLISHED/PARTIAL/FAILED).
 */
export async function processPublishJob(
  job: Job<PublishJobData> | { data: PublishJobData }
): Promise<PublishExecutionResult> {
  const { postId, retryTargetId } = job.data;

  // 1. Query Post
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);

  if (!post) {
    throw new Error(`Post with ID ${postId} not found`);
  }

  // 2. Query Targets
  const targetsQuery = db
    .select({
      id: postTargets.id,
      postId: postTargets.postId,
      connectedAccountId: postTargets.connectedAccountId,
      platform: postTargets.platform,
      status: postTargets.status,
      retryCount: postTargets.retryCount,
    })
    .from(postTargets)
    .where(eq(postTargets.postId, postId));

  const targets = await targetsQuery;

  // Filter jika hanya retry untuk 1 target tertentu
  const eligibleTargets = retryTargetId
    ? targets.filter((t) => t.id === retryTargetId)
    : targets.filter((t) => t.status === "PENDING" || t.status === "FAILED");

  if (eligibleTargets.length === 0) {
    return {
      postId,
      postStatus: post.status as "PUBLISHED" | "PARTIAL" | "FAILED",
      results: [],
    };
  }

  // Update status ke PUBLISHING dan publikasikan event status real-time
  const startTime = new Date();
  await db
    .update(posts)
    .set({
      status: "PUBLISHING",
      updatedAt: startTime,
    })
    .where(eq(posts.id, postId));

  await publishPostEvent({
    type: "POST_STATUS_CHANGED",
    postId,
    userId: post.userId,
    status: "PUBLISHING",
  });

  try {
    // 3. Query Connected Accounts
    const accountIds = Array.from(new Set(eligibleTargets.map((t) => t.connectedAccountId)));
    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(inArray(connectedAccounts.id, accountIds));

    const accountsMap = new Map(accounts.map((a) => [a.id, a]));

  // 4. Eksekusi paralel per target
  const publishPromises = eligibleTargets.map(async (target) => {
    const account = accountsMap.get(target.connectedAccountId);
    if (!account) {
      return {
        targetId: target.id,
        platform: target.platform,
        success: false,
        errorCode: "ACCOUNT_NOT_FOUND",
        errorMessage: "Akun platform yang terhubung tidak ditemukan.",
      };
    }

    if (account.status === "NEEDS_REAUTH") {
      return {
        targetId: target.id,
        platform: target.platform,
        success: false,
        errorCode: "TOKEN_EXPIRED",
        errorMessage: "Akun memerlukan autentikasi ulang.",
        needsReauth: true,
      };
    }

    // Dekripsi token
    let accessToken: string;
    try {
      accessToken = decrypt(account.accessTokenEnc);
    } catch {
      return {
        targetId: target.id,
        platform: target.platform,
        success: false,
        errorCode: "DECRYPT_ERROR",
        errorMessage: "Gagal mendekripsi token akses akun.",
      };
    }

    // Kirim ke platform yang sesuai
    if (target.platform === "META_PAGE") {
      return publishToMeta(target.id, post, account, accessToken);
    } else if (target.platform === "INSTAGRAM") {
      return publishToInstagram(target.id, post, account, accessToken);
    } else if (target.platform === "TIKTOK") {
      return publishToTikTok(target.id, post, account, accessToken);
    } else if (target.platform === "THREADS") {
      return publishToThreads(target.id, post, account, accessToken);
    } else {
      return {
        targetId: target.id,
        platform: target.platform,
        success: false,
        errorCode: "UNSUPPORTED_PLATFORM",
        errorMessage: `Platform ${target.platform} belum didukung untuk publikasi.`,
      };
    }
  });

  const settledResults = await Promise.allSettled(publishPromises);

  const results: PlatformPublishResult[] = settledResults.map((res, index) => {
    if (res.status === "fulfilled") {
      return res.value;
    }
    const target = eligibleTargets[index]!;
    return {
      targetId: target.id,
      platform: target.platform,
      success: false,
      errorCode: "UNHANDLED_EXCEPTION",
      errorMessage: res.reason?.message || "Terjadi kesalahan internal saat publikasi",
    };
  });

  // 5. Update status di database
  const now = new Date();

  for (const res of results) {
    const currentTarget = eligibleTargets.find((t) => t.id === res.targetId);
    const newRetryCount = (currentTarget?.retryCount ?? 0) + (res.success ? 0 : 1);

    if (res.success) {
      await db
        .update(postTargets)
        .set({
          status: "PUBLISHED",
          platformPostId: res.platformPostId,
          publishedAt: res.publishedAt || now,
          errorCode: null,
          errorMessage: null,
          updatedAt: now,
        })
        .where(eq(postTargets.id, res.targetId));
    } else {
      await db
        .update(postTargets)
        .set({
          status: "FAILED",
          errorCode: res.errorCode || "FAILED",
          errorMessage: res.errorMessage || "Publikasi gagal",
          retryCount: newRetryCount,
          updatedAt: now,
        })
        .where(eq(postTargets.id, res.targetId));

      // Jika token kedaluwarsa, tandai connected_accounts
      if (res.needsReauth && currentTarget) {
        await db
          .update(connectedAccounts)
          .set({ status: "NEEDS_REAUTH", updatedAt: now })
          .where(eq(connectedAccounts.id, currentTarget.connectedAccountId));
      }
    }
  }

  // 6. Hitung status agregat Post
  const targetStatuses = targets.map((t) => {
    const res = results.find((r) => r.targetId === t.id);
    if (res) return res.success ? "PUBLISHED" : "FAILED";
    return t.status;
  });

  const totalTargets = targetStatuses.length;
  const publishedCount = targetStatuses.filter((s) => s === "PUBLISHED").length;
  const failedCount = targetStatuses.filter((s) => s === "FAILED").length;

  let postFinalStatus: "PUBLISHED" | "PARTIAL" | "FAILED";

  if (publishedCount === totalTargets && totalTargets > 0) {
    postFinalStatus = "PUBLISHED";
  } else if (publishedCount > 0 && failedCount > 0) {
    postFinalStatus = "PARTIAL";
  } else {
    postFinalStatus = "FAILED";
  }

    const publishedAt = postFinalStatus === "PUBLISHED" ? now : post.publishedAt;

    await db
      .update(posts)
      .set({
        status: postFinalStatus,
        publishedAt,
        updatedAt: now,
      })
      .where(eq(posts.id, postId));

    await publishPostEvent({
      type: "POST_STATUS_CHANGED",
      postId,
      userId: post.userId,
      status: postFinalStatus,
      publishedAt,
      targets: results.map((r) => ({
        id: r.targetId,
        platform: r.platform,
        status: r.success ? "PUBLISHED" : "FAILED",
        errorCode: r.errorCode,
        errorMessage: r.errorMessage,
        publishedAt: r.publishedAt,
      })),
    });

    return {
      postId,
      postStatus: postFinalStatus,
      results,
    };
  } catch (error) {
    const errorTime = new Date();
    await db
      .update(posts)
      .set({
        status: "FAILED",
        updatedAt: errorTime,
      })
      .where(eq(posts.id, postId))
      .catch(() => {});

    await publishPostEvent({
      type: "POST_STATUS_CHANGED",
      postId,
      userId: post.userId,
      status: "FAILED",
    }).catch(() => {});

    throw error;
  }
}

// ==========================================
// Worker Setup
// ==========================================

let publishWorker: Worker<PublishJobData> | null = null;

export function createPublishWorker(
  customConnection?: ReturnType<typeof getRedisClient>
): Worker<PublishJobData> {
  const connection = customConnection ?? getRedisClient();

  const worker = new Worker<PublishJobData>(
    PUBLISH_QUEUE_NAME,
    async (job) => {
      return await processPublishJob(job);
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[PublishWorker] Job ${job.id} for post ${job.data.postId} completed.`);
  });

  worker.on("failed", async (job, err) => {
    console.error(
      `[PublishWorker] Job ${job?.id} for post ${job?.data?.postId} failed with error:`,
      err
    );
    if (job?.data?.postId) {
      try {
        const [post] = await db.select().from(posts).where(eq(posts.id, job.data.postId)).limit(1);
        if (post && post.status === "PUBLISHING") {
          await db
            .update(posts)
            .set({ status: "FAILED", updatedAt: new Date() })
            .where(eq(posts.id, job.data.postId));

          await publishPostEvent({
            type: "POST_STATUS_CHANGED",
            postId: job.data.postId,
            userId: post.userId,
            status: "FAILED",
          });
        }
      } catch {
        // ignore
      }
    }
  });

  return worker;
}

export function getPublishWorker(): Worker<PublishJobData> {
  if (!publishWorker) {
    publishWorker = createPublishWorker();
  }
  return publishWorker;
}

// Jalankan otomatis jika file dieksekusi langsung
if (require.main === module) {
  console.log("[PublishWorker] Memulai Post Publisher Worker...");
  getPublishWorker();
}
