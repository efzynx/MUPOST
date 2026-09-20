import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  connectedAccounts,
  type ConnectedAccount,
  type PlatformType,
  type AccountStatus,
} from "@/lib/db/schema";
import { getRedisClient } from "@/lib/redis";
import { encrypt, decrypt } from "@/lib/crypto";
import { env } from "@/lib/env";

export interface TokenRefreshResult {
  success: boolean;
  newExpiresAt?: Date;
  error?: string;
}

export interface ConnectedAccountItem {
  id: string;
  userId: string;
  platform: PlatformType;
  platformAccountId: string;
  accountName: string;
  status: AccountStatus;
  tokenExpiresAt: Date | null;
  meta?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PlatformErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_NEEDS_REAUTH"
  | "TOKEN_EXPIRED"
  | "OAUTH_STATE_MISMATCH"
  | "OAUTH_TIMEOUT"
  | "OAUTH_ACCESS_DENIED"
  | "OAUTH_EXCHANGE_FAILED"
  | "PLATFORM_API_ERROR"
  | "REFRESH_FAILED"
  | "NO_PAGES_FOUND";

export class PlatformError extends Error {
  constructor(
    public code: PlatformErrorCode,
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "PlatformError";
    Object.setPrototypeOf(this, PlatformError.prototype);
  }
}

interface TikTokTokenApiResponse {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  expires_in?: number;
  error?: string | { code?: string | number; message?: string };
  error_code?: number;
  error_description?: string;
  description?: string;
  message?: string;
  data?: {
    access_token?: string;
    refresh_token?: string;
    open_id?: string;
    expires_in?: number;
  };
}

export class PlatformConnectorService {
  /**
   * Mengubah entity ConnectedAccount database menjadi objek aman tanpa token rahasia.
   */
  private mapToItem(acc: ConnectedAccount): ConnectedAccountItem {
    return {
      id: acc.id,
      userId: acc.userId,
      platform: acc.platform,
      platformAccountId: acc.platformAccountId,
      accountName: acc.accountName,
      status: acc.status,
      tokenExpiresAt: acc.tokenExpiresAt,
      meta: acc.meta as Record<string, unknown> | null,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
    };
  }

  // =========================================================================
  // Task 4.2: Alur OAuth Meta
  // =========================================================================

  /**
   * Menghasilkan URL otorisasi OAuth 2.0 Meta dengan state unik di Redis.
   */
  async getMetaAuthUrl(userId: string, sessionId?: string, redirectUri?: string): Promise<string> {
    const state = randomUUID();
    const redis = getRedisClient();

    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = redirectUri || `${baseUrl}/api/connect/meta/callback`;

    const statePayload = JSON.stringify({
      userId,
      sessionId: sessionId || null,
      platform: "META_PAGE",
      redirectUri: callbackUrl,
      createdAt: Date.now(),
    });

    // Simpan state dengan TTL 10 menit (600 detik) untuk mencegah CSRF
    await redis.set(`oauth_state:${state}`, statePayload, "EX", 600);

    const params = new URLSearchParams({
      client_id: env.META_APP_ID,
      redirect_uri: callbackUrl,
      scope:
        "pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management",
      state,
      response_type: "code",
      auth_type: "rerequest",
    });

    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Memproses callback OAuth Meta: validasi state, tukar code→token, fetch pages & IG accounts,
   * dan UPSERT ke tabel connected_accounts dengan enkripsi AES-256-GCM.
   */
  async handleMetaCallback(
    code: string,
    state: string,
    redirectUri?: string
  ): Promise<ConnectedAccountItem[]> {
    const redis = getRedisClient();
    const stateKey = `oauth_state:${state}`;
    const stateRaw = await redis.get(stateKey);

    if (!stateRaw) {
      throw new PlatformError(
        "OAUTH_STATE_MISMATCH",
        400,
        "Parameter state OAuth tidak valid atau telah kedaluwarsa."
      );
    }

    let stateData: { userId: string; sessionId?: string; redirectUri?: string };
    try {
      stateData = JSON.parse(stateRaw);
    } catch {
      throw new PlatformError("OAUTH_STATE_MISMATCH", 400, "Data state OAuth rusak.");
    }

    const { userId } = stateData;
    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl =
      redirectUri || stateData.redirectUri || `${baseUrl}/api/connect/meta/callback`;

    // 1. Tukar authorization code dengan access token via server-side request (timeout 30 detik)
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", env.META_APP_ID);
    tokenUrl.searchParams.set("client_secret", env.META_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", callbackUrl);
    tokenUrl.searchParams.set("code", code);

    let tokenRes: Response;
    try {
      tokenRes = await fetch(tokenUrl.toString(), {
        method: "GET",
        signal: AbortSignal.timeout(30000),
      });
    } catch (err: unknown) {
      const isError = err instanceof Error;
      const errName = isError ? err.name : "";
      const errMsg = isError ? err.message : String(err);

      if (
        errName === "TimeoutError" ||
        errName === "AbortError" ||
        errMsg.toLowerCase().includes("timeout")
      ) {
        throw new PlatformError(
          "OAUTH_TIMEOUT",
          504,
          "Pertukaran token Meta melebihi batas waktu 30 detik."
        );
      }
      throw new PlatformError(
        "OAUTH_EXCHANGE_FAILED",
        502,
        `Gagal menghubungi server otorisasi Meta: ${errMsg}`
      );
    }

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || tokenJson.error) {
      const errorMsg = tokenJson.error?.message || "Gagal menukar kode otorisasi Meta.";
      throw new PlatformError("OAUTH_EXCHANGE_FAILED", 400, errorMsg, tokenJson.error);
    }

    const userAccessToken: string = tokenJson.access_token;
    let effectiveUserToken = userAccessToken;

    // Coba tukar short-lived token menjadi long-lived user token
    try {
      const exchangeUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
      exchangeUrl.searchParams.set("grant_type", "fb_exchange_token");
      exchangeUrl.searchParams.set("client_id", env.META_APP_ID);
      exchangeUrl.searchParams.set("client_secret", env.META_APP_SECRET);
      exchangeUrl.searchParams.set("fb_exchange_token", userAccessToken);

      const exchangeRes = await fetch(exchangeUrl.toString(), {
        method: "GET",
        signal: AbortSignal.timeout(30000),
      });

      if (exchangeRes.ok) {
        const exchangeJson = await exchangeRes.json();
        if (exchangeJson.access_token) {
          effectiveUserToken = exchangeJson.access_token;
        }
      }
    } catch {
      // Jika penukaran long-lived gagal, tetap gunakan userAccessToken awal
    }

    // 2. Ambil daftar Facebook Pages pengguna (timeout 10 detik per requirement 4.4)
    const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${effectiveUserToken}`;
    let pagesRes: Response;
    try {
      pagesRes = await fetch(pagesUrl, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new PlatformError(
        "PLATFORM_API_ERROR",
        502,
        `Gagal mengambil daftar Facebook Pages: ${errMsg}`
      );
    }

    const pagesJson = await pagesRes.json();
    // eslint-disable-next-line no-console
    console.log("[Meta OAuth] /me/accounts response:", JSON.stringify(pagesJson));
    if (!pagesRes.ok || pagesJson.error) {
      throw new PlatformError(
        "PLATFORM_API_ERROR",
        502,
        pagesJson.error?.message || "Gagal mengambil daftar Facebook Pages."
      );
    }

    const pagesList: Array<{ id: string; name: string; access_token: string }> =
      pagesJson.data || [];

    // Fallback: Jika /me/accounts kosong, coba periksa apakah Halaman berada di bawah Meta Business Portfolio
    if (pagesList.length === 0) {
      try {
        const bizUrl = `https://graph.facebook.com/v21.0/me/businesses?fields=id,name,owned_pages{id,name,access_token},client_pages{id,name,access_token}&access_token=${effectiveUserToken}`;
        const bizRes = await fetch(bizUrl, {
          method: "GET",
          signal: AbortSignal.timeout(10000),
        });
        if (bizRes.ok) {
          const bizJson = await bizRes.json();
          // eslint-disable-next-line no-console
          console.log("[Meta OAuth] /me/businesses response:", JSON.stringify(bizJson));
          const businesses: Array<{
            owned_pages?: { data?: Array<{ id: string; name: string; access_token: string }> };
            client_pages?: { data?: Array<{ id: string; name: string; access_token: string }> };
          }> = bizJson.data || [];
          for (const biz of businesses) {
            const owned = biz.owned_pages?.data || [];
            const client = biz.client_pages?.data || [];
            for (const p of [...owned, ...client]) {
              if (p.id && p.access_token && !pagesList.some((x) => x.id === p.id)) {
                pagesList.push({ id: p.id, name: p.name, access_token: p.access_token });
              }
            }
          }
        }
      } catch (bizErr) {
        // eslint-disable-next-line no-console
        console.error("[Meta OAuth] Error fetching /me/businesses fallback:", bizErr);
      }
    }

    if (pagesList.length === 0) {
      throw new PlatformError(
        "NO_PAGES_FOUND",
        400,
        "Tidak ada Facebook Page yang ditemukan atau dipilih. Pastikan akun Facebook Anda mengelola minimal 1 Facebook Page (Halaman) dan Anda mencentang izin halaman tersebut saat otorisasi Meta."
      );
    }

    const savedAccounts: ConnectedAccountItem[] = [];

    // 3. Simpan Facebook Pages & periksa Instagram Business Accounts
    for (const page of pagesList) {
      const pageTokenEnc = encrypt(page.access_token);

      const [upsertedPage] = await db
        .insert(connectedAccounts)
        .values({
          userId,
          platform: "META_PAGE",
          platformAccountId: page.id,
          accountName: page.name,
          accessTokenEnc: pageTokenEnc,
          refreshTokenEnc: null,
          tokenExpiresAt: null, // Page tokens permanen
          status: "ACTIVE",
          meta: { pageId: page.id, pageName: page.name, refreshRetryCount: 0 },
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            connectedAccounts.userId,
            connectedAccounts.platform,
            connectedAccounts.platformAccountId,
          ],
          set: {
            accountName: page.name,
            accessTokenEnc: pageTokenEnc,
            status: "ACTIVE",
            meta: { pageId: page.id, pageName: page.name, refreshRetryCount: 0 },
            updatedAt: new Date(),
          },
        })
        .returning();

      if (upsertedPage) {
        savedAccounts.push(this.mapToItem(upsertedPage));
      }

      // Periksa Instagram Business Account yang terhubung dengan Page ini
      try {
        const igUrl = `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,username,name}&access_token=${page.access_token}`;
        const igRes = await fetch(igUrl, {
          method: "GET",
          signal: AbortSignal.timeout(10000),
        });

        if (igRes.ok) {
          const igJson = await igRes.json();
          const igAccount = igJson.instagram_business_account;

          if (igAccount && igAccount.id) {
            const igName = igAccount.name || igAccount.username || `${page.name} (Instagram)`;

            const [upsertedIg] = await db
              .insert(connectedAccounts)
              .values({
                userId,
                platform: "INSTAGRAM",
                platformAccountId: igAccount.id,
                accountName: igName,
                accessTokenEnc: pageTokenEnc, // Instagram mempublikasi menggunakan Page token
                refreshTokenEnc: null,
                tokenExpiresAt: null,
                status: "ACTIVE",
                meta: {
                  pageId: page.id,
                  pageName: page.name,
                  instagramId: igAccount.id,
                  username: igAccount.username || null,
                  refreshRetryCount: 0,
                },
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [
                  connectedAccounts.userId,
                  connectedAccounts.platform,
                  connectedAccounts.platformAccountId,
                ],
                set: {
                  accountName: igName,
                  accessTokenEnc: pageTokenEnc,
                  status: "ACTIVE",
                  meta: {
                    pageId: page.id,
                    pageName: page.name,
                    instagramId: igAccount.id,
                    username: igAccount.username || null,
                    refreshRetryCount: 0,
                  },
                  updatedAt: new Date(),
                },
              })
              .returning();

            if (upsertedIg) {
              savedAccounts.push(this.mapToItem(upsertedIg));
            }
          }
        }
      } catch {
        // Jika pembacaan Instagram gagal, Facebook page tetap berhasil disimpan
      }
    }

    // 4. Hapus state dari Redis setelah sukses
    await redis.del(stateKey);

    return savedAccounts;
  }

  // =========================================================================
  // Task 4.1: Token Management
  // =========================================================================

  /**
   * Mengambil token akses valid yang siap dipakai.
   * Mendekripsi token, memeriksa masa berlaku, dan memicu refresh otomatis jika sisa masa berlaku < 24 jam.
   */
  async getValidToken(accountId: string): Promise<string> {
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, accountId))
      .limit(1);

    if (!account) {
      throw new PlatformError("ACCOUNT_NOT_FOUND", 404, "Akun terhubung tidak ditemukan.");
    }

    if (account.status === "NEEDS_REAUTH") {
      throw new PlatformError(
        "ACCOUNT_NEEDS_REAUTH",
        401,
        "Koneksi akun memerlukan autentikasi ulang."
      );
    }

    // Periksa masa berlaku jika ada tokenExpiresAt (seperti TikTok)
    if (account.tokenExpiresAt) {
      const remainingMs = account.tokenExpiresAt.getTime() - Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

      if (remainingMs < TWENTY_FOUR_HOURS) {
        // Trigger auto-refresh proaktif
        const refreshResult = await this.refreshToken(accountId);

        if (refreshResult.success) {
          const [updatedAccount] = await db
            .select()
            .from(connectedAccounts)
            .where(eq(connectedAccounts.id, accountId))
            .limit(1);

          if (updatedAccount) {
            return decrypt(updatedAccount.accessTokenEnc);
          }
        }

        // Jika refresh gagal dan token sudah kedaluwarsa sepenuhnya
        if (remainingMs <= 0) {
          throw new PlatformError(
            "TOKEN_EXPIRED",
            401,
            "Token akses telah kedaluwarsa dan proses refresh otomatis gagal."
          );
        }
      }
    }

    // Token masih berlaku atau bersifat permanen (Meta)
    return decrypt(account.accessTokenEnc);
  }

  /**
   * Merefresh token pihak ketiga sesuai platform akun.
   * Mengenkripsi token baru, menyimpan ke DB, dan mengelola counter percobaan (maks. 3 kali).
   */
  async refreshToken(accountId: string): Promise<TokenRefreshResult> {
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, accountId))
      .limit(1);

    if (!account) {
      throw new PlatformError("ACCOUNT_NOT_FOUND", 404, "Akun terhubung tidak ditemukan.");
    }

    const currentMeta = (account.meta as Record<string, unknown>) || {};
    const previousRetries =
      typeof currentMeta.refreshRetryCount === "number" ? currentMeta.refreshRetryCount : 0;
    const currentRetries = previousRetries + 1;

    try {
      if (account.platform === "TIKTOK") {
        if (!account.refreshTokenEnc) {
          throw new Error("Refresh token TikTok tidak ditemukan.");
        }

        const plainRefreshToken = decrypt(account.refreshTokenEnc);

        const bodyParams = new URLSearchParams({
          client_key: env.TIKTOK_CLIENT_KEY,
          client_secret: env.TIKTOK_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: plainRefreshToken,
        });

        const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: bodyParams.toString(),
          signal: AbortSignal.timeout(30000),
        });

        const resJson = (await res.json()) as TikTokTokenApiResponse;
        const dataObj = resJson.data || {};
        const newAccessToken = resJson.access_token || dataObj.access_token;
        const newRefreshToken = resJson.refresh_token || dataObj.refresh_token;

        const isErrorOk =
          !resJson.error ||
          resJson.error === "ok" ||
          (typeof resJson.error === "object" &&
            (resJson.error.code === "ok" || resJson.error.code === 0));

        if (!res.ok || !isErrorOk || !newAccessToken) {
          const errMsg =
            resJson.error_description ||
            (typeof resJson.error === "object" ? resJson.error.message : null) ||
            (typeof resJson.error === "string" ? resJson.error : null) ||
            "Gagal memperbarui token TikTok.";
          throw new Error(errMsg);
        }

        const newAccessTokenEnc = encrypt(newAccessToken);
        const newRefreshTokenEnc = newRefreshToken
          ? encrypt(newRefreshToken)
          : account.refreshTokenEnc;
        const expiresInSec = resJson.expires_in || dataObj.expires_in || 86400;
        const newExpiresAt = new Date(Date.now() + expiresInSec * 1000);

        await db
          .update(connectedAccounts)
          .set({
            accessTokenEnc: newAccessTokenEnc,
            refreshTokenEnc: newRefreshTokenEnc,
            tokenExpiresAt: newExpiresAt,
            status: "ACTIVE",
            meta: {
              ...currentMeta,
              refreshRetryCount: 0,
              lastRefreshError: null,
            },
            updatedAt: new Date(),
          })
          .where(eq(connectedAccounts.id, accountId));

        return { success: true, newExpiresAt };
      } else if (account.platform === "META_PAGE" || account.platform === "INSTAGRAM") {
        // Meta page token bersifat permanen, verifikasi validitas via Graph API
        const plainToken = decrypt(account.accessTokenEnc);
        const verifyRes = await fetch(
          `https://graph.facebook.com/v21.0/me?access_token=${plainToken}`,
          {
            method: "GET",
            signal: AbortSignal.timeout(10000),
          }
        );

        if (!verifyRes.ok) {
          const verifyJson = await verifyRes.json();
          throw new Error(verifyJson.error?.message || "Token Meta tidak lagi valid.");
        }

        // Token valid, reset counter
        await db
          .update(connectedAccounts)
          .set({
            status: "ACTIVE",
            meta: {
              ...currentMeta,
              refreshRetryCount: 0,
              lastRefreshError: null,
            },
            updatedAt: new Date(),
          })
          .where(eq(connectedAccounts.id, accountId));

        return { success: true };
      }

      if (account.platform === "THREADS") {
        const plainAccessToken = decrypt(account.accessTokenEnc);
        const refreshUrl = new URL("https://graph.threads.net/refresh_access_token");
        refreshUrl.searchParams.set("grant_type", "th_refresh_token");
        refreshUrl.searchParams.set("access_token", plainAccessToken);

        const res = await fetch(refreshUrl.toString(), {
          method: "GET",
          signal: AbortSignal.timeout(30000),
        });

        const resJson = await res.json();
        if (!res.ok || resJson.error || !resJson.access_token) {
          const errMsg = resJson.error?.message || "Gagal memperbarui token Threads.";
          throw new Error(errMsg);
        }

        const newAccessTokenEnc = encrypt(resJson.access_token);
        const expiresInSec = resJson.expires_in || 5184000;
        const newExpiresAt = new Date(Date.now() + expiresInSec * 1000);

        await db
          .update(connectedAccounts)
          .set({
            accessTokenEnc: newAccessTokenEnc,
            tokenExpiresAt: newExpiresAt,
            status: "ACTIVE",
            meta: {
              ...currentMeta,
              refreshRetryCount: 0,
              lastRefreshError: null,
            },
            updatedAt: new Date(),
          })
          .where(eq(connectedAccounts.id, accountId));

        return { success: true };
      }

      throw new Error(`Platform ${account.platform} tidak mendukung refresh token.`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Gagal refresh token.";

      if (currentRetries >= 3) {
        await this.markAccountStale(accountId);
        await db
          .update(connectedAccounts)
          .set({
            meta: {
              ...currentMeta,
              refreshRetryCount: currentRetries,
              lastRefreshError: errorMsg,
            },
            updatedAt: new Date(),
          })
          .where(eq(connectedAccounts.id, accountId));

        return {
          success: false,
          error: `Maksimal 3 percobaan refresh tercapai. Akun ditandai NEEDS_REAUTH: ${errorMsg}`,
        };
      }

      await db
        .update(connectedAccounts)
        .set({
          meta: {
            ...currentMeta,
            refreshRetryCount: currentRetries,
            lastRefreshError: errorMsg,
          },
          updatedAt: new Date(),
        })
        .where(eq(connectedAccounts.id, accountId));

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Menandai akun sebagai memerlukan reautentikasi (NEEDS_REAUTH).
   */
  async markAccountStale(accountId: string): Promise<void> {
    await db
      .update(connectedAccounts)
      .set({
        status: "NEEDS_REAUTH",
        updatedAt: new Date(),
      })
      .where(eq(connectedAccounts.id, accountId));
  }

  /**
   * Mengambil semua akun yang terhubung untuk pengguna tertentu tanpa membocorkan token.
   */
  async getConnectedAccounts(userId: string): Promise<ConnectedAccountItem[]> {
    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));

    return accounts.map((acc) => this.mapToItem(acc));
  }

  /**
   * Mengambil daftar Facebook Pages yang terhubung untuk pengguna tertentu.
   */
  async fetchMetaPages(userId: string): Promise<ConnectedAccountItem[]> {
    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.platform, "META_PAGE"))
      );

    return accounts.map((acc) => this.mapToItem(acc));
  }

  // =========================================================================
  // Task 4.4: Alur OAuth TikTok
  // =========================================================================

  /**
   * Menghasilkan URL otorisasi OAuth 2.0 TikTok dengan state unik di Redis.
   */
  async getTikTokAuthUrl(
    userId: string,
    sessionId?: string,
    redirectUri?: string
  ): Promise<string> {
    const state = randomUUID();
    const redis = getRedisClient();

    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = redirectUri || `${baseUrl}/api/connect/tiktok/callback`;

    const statePayload = JSON.stringify({
      userId,
      sessionId: sessionId || null,
      platform: "TIKTOK",
      redirectUri: callbackUrl,
      createdAt: Date.now(),
    });

    await redis.set(`oauth_state:${state}`, statePayload, "EX", 600);

    const params = new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY,
      scope: "user.info.basic,video.publish",
      response_type: "code",
      redirect_uri: callbackUrl,
      state,
    });

    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  /**
   * Memproses callback OAuth TikTok: validasi state, tukar code→token, fetch user display name,
   * dan UPSERT ke tabel connected_accounts dengan enkripsi AES-256-GCM.
   */
  async handleTikTokCallback(
    code: string,
    state: string,
    redirectUri?: string
  ): Promise<ConnectedAccountItem> {
    const redis = getRedisClient();
    const stateKey = `oauth_state:${state}`;
    const stateRaw = await redis.get(stateKey);

    if (!stateRaw) {
      throw new PlatformError(
        "OAUTH_STATE_MISMATCH",
        400,
        "Parameter state OAuth TikTok tidak valid atau telah kedaluwarsa."
      );
    }

    let stateData: { userId: string; sessionId?: string; redirectUri?: string };
    try {
      stateData = JSON.parse(stateRaw);
    } catch {
      throw new PlatformError("OAUTH_STATE_MISMATCH", 400, "Data state OAuth TikTok rusak.");
    }

    const { userId } = stateData;
    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl =
      redirectUri || stateData.redirectUri || `${baseUrl}/api/connect/tiktok/callback`;

    // 1. Tukar code dengan access token via POST server-side ke TikTok (timeout 30 detik)
    const bodyParams = new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
    });

    let tokenRes: Response;
    try {
      tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: bodyParams.toString(),
        signal: AbortSignal.timeout(30000),
      });
    } catch (err: unknown) {
      const isError = err instanceof Error;
      const errName = isError ? err.name : "";
      const errMsg = isError ? err.message : String(err);

      if (
        errName === "TimeoutError" ||
        errName === "AbortError" ||
        errMsg.toLowerCase().includes("timeout")
      ) {
        throw new PlatformError(
          "OAUTH_TIMEOUT",
          504,
          "Pertukaran token TikTok melebihi batas waktu 30 detik."
        );
      }
      throw new PlatformError(
        "OAUTH_EXCHANGE_FAILED",
        502,
        `Gagal menghubungi server otorisasi TikTok: ${errMsg}`
      );
    }

    const tokenJson = (await tokenRes.json()) as TikTokTokenApiResponse;
    // eslint-disable-next-line no-console
    console.log("[TikTok Token Exchange Debug]", {
      status: tokenRes.status,
      ok: tokenRes.ok,
      response: tokenJson,
    });

    // Dukung properti root (TikTok v2 standard) maupun nested di dalam data (v1/legacy)
    const dataObj = tokenJson.data || {};
    const accessToken = tokenJson.access_token || dataObj.access_token;
    const refreshToken = tokenJson.refresh_token || dataObj.refresh_token;
    const openId = tokenJson.open_id || dataObj.open_id || randomUUID();
    const expiresInSec = tokenJson.expires_in || dataObj.expires_in || 86400;
    const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000);

    const isTokenErrorOk =
      !tokenJson.error ||
      tokenJson.error === "ok" ||
      (typeof tokenJson.error === "object" &&
        (tokenJson.error.code === "ok" || tokenJson.error.code === 0));

    const hasError =
      !tokenRes.ok ||
      !isTokenErrorOk ||
      (tokenJson.error_code !== undefined && tokenJson.error_code !== 0) ||
      !accessToken;

    if (hasError) {
      const errorMsg =
        tokenJson.error_description ||
        (typeof tokenJson.error === "object" ? tokenJson.error.message : null) ||
        (typeof tokenJson.error === "string" ? tokenJson.error : null) ||
        tokenJson.description ||
        tokenJson.message ||
        "Gagal menukar kode otorisasi TikTok.";
      // eslint-disable-next-line no-console
      console.error("[TikTok Token Exchange Error]", {
        status: tokenRes.status,
        errorMsg,
        response: tokenJson,
      });
      throw new PlatformError("OAUTH_EXCHANGE_FAILED", 400, errorMsg, tokenJson);
    }

    // 2. Ambil display name akun pengguna via /v2/user/info/ (timeout 10 detik)
    let accountName = `TikTok (${openId.substring(0, 8)})`;
    try {
      const userInfoRes = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (userInfoRes.ok) {
        const userInfoJson = (await userInfoRes.json()) as {
          data?: {
            user?: {
              display_name?: string;
              open_id?: string;
            };
          };
        };
        if (userInfoJson.data?.user?.display_name) {
          accountName = userInfoJson.data.user.display_name;
        }
      }
    } catch {
      // Jika fetch user info gagal, tetap gunakan default account name
    }

    // 3. Enkripsi token dan UPSERT ke connected_accounts
    const accessTokenEnc = encrypt(accessToken);
    const refreshTokenEnc = refreshToken ? encrypt(refreshToken) : null;

    const [upsertedAccount] = await db
      .insert(connectedAccounts)
      .values({
        userId,
        platform: "TIKTOK",
        platformAccountId: openId,
        accountName,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
        status: "ACTIVE",
        meta: { openId, refreshRetryCount: 0 },
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          connectedAccounts.userId,
          connectedAccounts.platform,
          connectedAccounts.platformAccountId,
        ],
        set: {
          accountName,
          accessTokenEnc,
          refreshTokenEnc,
          tokenExpiresAt,
          status: "ACTIVE",
          meta: { openId, refreshRetryCount: 0 },
          updatedAt: new Date(),
        },
      })
      .returning();

    // 4. Hapus state dari Redis
    await redis.del(stateKey);

    if (!upsertedAccount) {
      throw new PlatformError(
        "PLATFORM_API_ERROR",
        500,
        "Gagal menyimpan akun TikTok ke database."
      );
    }

    return this.mapToItem(upsertedAccount);
  }

  // =========================================================================
  // Threads API OAuth (Requirement: Threads Platform Support)
  // =========================================================================

  /**
   * Menghasilkan URL otorisasi Threads OAuth dengan state unik untuk mencegah CSRF.
   */
  async getThreadsAuthUrl(userId: string, redirectUri?: string): Promise<string> {
    const redis = getRedisClient();
    const state = randomUUID();
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = redirectUri || `${baseUrl}/api/connect/threads/callback`;

    const statePayload = JSON.stringify({
      userId,
      platform: "THREADS",
      redirectUri: callbackUrl,
      createdAt: Date.now(),
    });

    // Simpan state dengan TTL 10 menit (600 detik)
    await redis.set(`oauth_state:${state}`, statePayload, "EX", 600);

    const threadsAppId = process.env.THREADS_APP_ID || env.THREADS_APP_ID || env.META_APP_ID;

    const params = new URLSearchParams({
      client_id: threadsAppId,
      redirect_uri: callbackUrl,
      scope: "threads_basic,threads_content_publish",
      state,
      response_type: "code",
    });

    return `https://threads.net/oauth/authorize?${params.toString()}`;
  }

  /**
   * Memproses callback OAuth Threads: validasi state, tukar code→short-lived token→long-lived token,
   * fetch user profile, dan UPSERT ke tabel connected_accounts.
   */
  async handleThreadsCallback(
    rawCode: string,
    state: string,
    redirectUri?: string
  ): Promise<ConnectedAccountItem> {
    const redis = getRedisClient();
    const stateKey = `oauth_state:${state}`;
    const stateRaw = await redis.get(stateKey);

    if (!stateRaw) {
      throw new PlatformError(
        "OAUTH_STATE_MISMATCH",
        400,
        "Parameter state OAuth tidak valid atau telah kedaluwarsa."
      );
    }

    let stateData: { userId: string; redirectUri?: string };
    try {
      stateData = JSON.parse(stateRaw);
    } catch {
      throw new PlatformError("OAUTH_STATE_MISMATCH", 400, "Data state OAuth rusak.");
    }

    const { userId } = stateData;
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl =
      redirectUri || stateData.redirectUri || `${baseUrl}/api/connect/threads/callback`;
    const threadsAppId = process.env.THREADS_APP_ID || env.THREADS_APP_ID || env.META_APP_ID;
    const threadsAppSecret =
      process.env.THREADS_APP_SECRET || env.THREADS_APP_SECRET || env.META_APP_SECRET;

    // Bersihkan suffix '#_' jika ada
    const code = rawCode.replace(/#_$/, "");

    // 1. Tukar authorization code dengan short-lived token via POST
    const tokenUrl = "https://graph.threads.net/oauth/access_token";
    const tokenBody = new URLSearchParams({
      client_id: threadsAppId,
      client_secret: threadsAppSecret,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
      code,
    });

    let tokenRes: Response;
    try {
      tokenRes = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenBody.toString(),
        signal: AbortSignal.timeout(30000),
      });
    } catch (err: unknown) {
      const isError = err instanceof Error;
      const errMsg = isError ? err.message : String(err);
      if (
        isError &&
        (err.name === "TimeoutError" ||
          err.name === "AbortError" ||
          errMsg.toLowerCase().includes("timeout"))
      ) {
        throw new PlatformError(
          "OAUTH_TIMEOUT",
          504,
          "Pertukaran token Threads melebihi batas waktu 30 detik."
        );
      }
      throw new PlatformError(
        "OAUTH_EXCHANGE_FAILED",
        502,
        `Gagal menghubungi server otorisasi Threads: ${errMsg}`
      );
    }

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || tokenJson.error || !tokenJson.access_token) {
      const errorMsg =
        tokenJson.error_message ||
        tokenJson.error?.message ||
        "Gagal menukar kode otorisasi Threads.";
      throw new PlatformError("OAUTH_EXCHANGE_FAILED", 400, errorMsg, tokenJson.error);
    }

    const shortLivedToken: string = tokenJson.access_token;
    const threadsUserId: string = String(tokenJson.user_id || "");

    // 2. Tukar short-lived token menjadi long-lived token (masa aktif ~60 hari)
    let effectiveToken = shortLivedToken;
    let expiresInSec = 5184000; // default 60 hari

    try {
      const exchangeUrl = new URL("https://graph.threads.net/access_token");
      exchangeUrl.searchParams.set("grant_type", "th_exchange_token");
      exchangeUrl.searchParams.set("client_secret", threadsAppSecret);
      exchangeUrl.searchParams.set("access_token", shortLivedToken);

      const exchangeRes = await fetch(exchangeUrl.toString(), {
        method: "GET",
        signal: AbortSignal.timeout(30000),
      });

      if (exchangeRes.ok) {
        const exchangeJson = await exchangeRes.json();
        if (exchangeJson.access_token) {
          effectiveToken = exchangeJson.access_token;
          expiresInSec = exchangeJson.expires_in || 5184000;
        }
      }
    } catch {
      // Jika gagal exchange long-lived, tetap gunakan short-lived token
    }

    const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000);

    // 3. Ambil data profil Threads
    let accountName = "Threads User";
    let profilePic: string | null = null;
    try {
      const profileUrl = `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${effectiveToken}`;
      const profileRes = await fetch(profileUrl, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });

      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        accountName = profileJson.username || profileJson.name || accountName;
        profilePic = profileJson.threads_profile_picture_url || null;
      }
    } catch {
      // Gunakan nama akun default jika fetch gagal
    }

    // 4. Enkripsi token dan UPSERT ke connected_accounts
    const accessTokenEnc = encrypt(effectiveToken);

    const [upsertedAccount] = await db
      .insert(connectedAccounts)
      .values({
        userId,
        platform: "THREADS",
        platformAccountId: threadsUserId || userId,
        accountName,
        accessTokenEnc,
        refreshTokenEnc: null,
        tokenExpiresAt,
        status: "ACTIVE",
        meta: {
          threadsUserId,
          username: accountName,
          profilePic,
          refreshRetryCount: 0,
        },
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          connectedAccounts.userId,
          connectedAccounts.platform,
          connectedAccounts.platformAccountId,
        ],
        set: {
          accountName,
          accessTokenEnc,
          tokenExpiresAt,
          status: "ACTIVE",
          meta: {
            threadsUserId,
            username: accountName,
            profilePic,
            refreshRetryCount: 0,
          },
          updatedAt: new Date(),
        },
      })
      .returning();

    // 5. Hapus state dari Redis
    await redis.del(stateKey);

    if (!upsertedAccount) {
      throw new PlatformError(
        "PLATFORM_API_ERROR",
        500,
        "Gagal menyimpan akun Threads ke database."
      );
    }

    return this.mapToItem(upsertedAccount);
  }

  /**
   * Menghapus koneksi akun berdasarkan ID dan memverifikasi kepemilikan oleh userId.
   */
  async disconnectAccount(userId: string, accountId: string): Promise<boolean> {
    const result = await db
      .delete(connectedAccounts)
      .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, userId)))
      .returning({ id: connectedAccounts.id });

    return result.length > 0;
  }
}

export const platformConnector = new PlatformConnectorService();
