import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  connectedAccounts,
  type ConnectedAccount,
  type PlatformType,
  type AccountStatus,
} from "@/lib/db/schema";
import { platformConnector, type ConnectedAccountItem } from "@/lib/services/platform-connector";
import { getTokenRefreshQueue } from "@/lib/queue/token-refresh-queue";

export type TokenHealthStatus = "HEALTHY" | "EXPIRING_SOON" | "EXPIRED" | "NEEDS_REAUTH";
export type AlertSeverity = "NONE" | "WARNING" | "CRITICAL";

export const EXPIRATION_WARNING_DAYS = 7;
export const EXPIRATION_WARNING_MS = EXPIRATION_WARNING_DAYS * 24 * 60 * 60 * 1000;

export interface AccountTokenHealth {
  accountId: string;
  userId: string;
  platform: PlatformType;
  accountName: string;
  platformAccountId: string;
  status: AccountStatus;
  healthStatus: TokenHealthStatus;
  severity: AlertSeverity;
  tokenExpiresAt: Date | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  isExpiringSoon: boolean;
  isExpired: boolean;
  needsReauth: boolean;
  requiresAction: boolean;
  canAutoRefresh: boolean;
  message: string;
  notificationMessage?: string | null;
}

export interface UserTokenAlert {
  accountId: string;
  platform: PlatformType;
  accountName: string;
  severity: AlertSeverity;
  healthStatus: TokenHealthStatus;
  message: string;
  daysRemaining: number | null;
  action: "REAUTH" | "REFRESH";
  canAutoRefresh: boolean;
}

export interface UserTokenHealthSummary {
  totalAccounts: number;
  healthyCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  needsReauthCount: number;
  actionRequiredCount: number;
  overallStatus: "HEALTHY" | "WARNING" | "CRITICAL";
  accounts: AccountTokenHealth[];
  alerts: UserTokenAlert[];
}

export class TokenHealthService {
  /**
   * Menilai status kesehatan token dari satu akun terhubung.
   */
  assessAccount(
    account: ConnectedAccount | ConnectedAccountItem,
    now: Date = new Date()
  ): AccountTokenHealth {
    const meta = (account.meta as Record<string, unknown>) || {};
    const notification = meta.notification as { message?: string } | undefined;
    const notificationMessage = notification?.message || null;

    const canAutoRefresh =
      account.platform === "TIKTOK" ||
      account.platform === "THREADS" ||
      account.platform === "META_PAGE" ||
      account.platform === "INSTAGRAM";

    // 1. Cek jika status eksplisit NEEDS_REAUTH
    if (account.status === "NEEDS_REAUTH") {
      return {
        accountId: account.id,
        userId: account.userId,
        platform: account.platform,
        accountName: account.accountName,
        platformAccountId: account.platformAccountId,
        status: account.status,
        healthStatus: "NEEDS_REAUTH",
        severity: "CRITICAL",
        tokenExpiresAt: account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null,
        daysRemaining: 0,
        hoursRemaining: 0,
        isExpiringSoon: false,
        isExpired: true,
        needsReauth: true,
        requiresAction: true,
        canAutoRefresh: false,
        message: `Koneksi akun ${account.accountName} (${account.platform}) membutuhkan autentikasi ulang.`,
        notificationMessage,
      };
    }

    // 2. Cek jika status eksplisit EXPIRED
    if (account.status === "EXPIRED") {
      return {
        accountId: account.id,
        userId: account.userId,
        platform: account.platform,
        accountName: account.accountName,
        platformAccountId: account.platformAccountId,
        status: account.status,
        healthStatus: "EXPIRED",
        severity: "CRITICAL",
        tokenExpiresAt: account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null,
        daysRemaining: 0,
        hoursRemaining: 0,
        isExpiringSoon: false,
        isExpired: true,
        needsReauth: true,
        requiresAction: true,
        canAutoRefresh,
        message: `Token akun ${account.accountName} telah kedaluwarsa. Silakan perbarui atau hubungkan ulang.`,
        notificationMessage,
      };
    }

    // 3. Jika tokenExpiresAt ditentukan, periksa waktu relatifnya
    if (account.tokenExpiresAt) {
      const expiresAt = new Date(account.tokenExpiresAt);
      const diffMs = expiresAt.getTime() - now.getTime();

      // Sudah melewati masa berlaku
      if (diffMs <= 0) {
        return {
          accountId: account.id,
          userId: account.userId,
          platform: account.platform,
          accountName: account.accountName,
          platformAccountId: account.platformAccountId,
          status: account.status,
          healthStatus: "EXPIRED",
          severity: "CRITICAL",
          tokenExpiresAt: expiresAt,
          daysRemaining: 0,
          hoursRemaining: 0,
          isExpiringSoon: false,
          isExpired: true,
          needsReauth: true,
          requiresAction: true,
          canAutoRefresh,
          message: `Token akun ${account.accountName} telah kedaluwarsa pada ${expiresAt.toLocaleDateString("id-ID")}.`,
          notificationMessage,
        };
      }

      // Mendekati kedaluwarsa (<= 7 hari)
      if (diffMs <= EXPIRATION_WARNING_MS) {
        const daysRemaining = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
        const hoursRemaining = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));

        return {
          accountId: account.id,
          userId: account.userId,
          platform: account.platform,
          accountName: account.accountName,
          platformAccountId: account.platformAccountId,
          status: account.status,
          healthStatus: "EXPIRING_SOON",
          severity: "WARNING",
          tokenExpiresAt: expiresAt,
          daysRemaining,
          hoursRemaining,
          isExpiringSoon: true,
          isExpired: false,
          needsReauth: false,
          requiresAction: true,
          canAutoRefresh,
          message: `Token akun ${account.accountName} akan kedaluwarsa dalam ${daysRemaining} hari. Segera lakukan pembaruan token.`,
          notificationMessage,
        };
      }

      // Token masih aman (> 7 hari)
      const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      const hoursRemaining = Math.ceil(diffMs / (60 * 60 * 1000));

      return {
        accountId: account.id,
        userId: account.userId,
        platform: account.platform,
        accountName: account.accountName,
        platformAccountId: account.platformAccountId,
        status: account.status,
        healthStatus: "HEALTHY",
        severity: "NONE",
        tokenExpiresAt: expiresAt,
        daysRemaining,
        hoursRemaining,
        isExpiringSoon: false,
        isExpired: false,
        needsReauth: false,
        requiresAction: false,
        canAutoRefresh,
        message: "Token aktif dan dalam kondisi prima.",
        notificationMessage,
      };
    }

    // 4. Token permanen (seperti Meta Page token) tanpa batas tanggal kadaluwarsa
    return {
      accountId: account.id,
      userId: account.userId,
      platform: account.platform,
      accountName: account.accountName,
      platformAccountId: account.platformAccountId,
      status: account.status,
      healthStatus: "HEALTHY",
      severity: "NONE",
      tokenExpiresAt: null,
      daysRemaining: null,
      hoursRemaining: null,
      isExpiringSoon: false,
      isExpired: false,
      needsReauth: false,
      requiresAction: false,
      canAutoRefresh: false,
      message: "Token aktif permanen (tanpa masa kedaluwarsa tetap).",
      notificationMessage,
    };
  }

  /**
   * Mengambil status kesehatan seluruh token yang dimiliki oleh pengguna tertentu.
   */
  async getUserTokensHealth(userId: string): Promise<UserTokenHealthSummary> {
    const rawAccounts = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId));

    const now = new Date();
    const evaluatedAccounts: AccountTokenHealth[] = rawAccounts.map((acc) =>
      this.assessAccount(acc, now)
    );

    let healthyCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let needsReauthCount = 0;

    const alerts: UserTokenAlert[] = [];

    for (const acc of evaluatedAccounts) {
      if (acc.healthStatus === "HEALTHY") {
        healthyCount++;
      } else if (acc.healthStatus === "EXPIRING_SOON") {
        expiringSoonCount++;
        alerts.push({
          accountId: acc.accountId,
          platform: acc.platform,
          accountName: acc.accountName,
          severity: "WARNING",
          healthStatus: "EXPIRING_SOON",
          message: acc.message,
          daysRemaining: acc.daysRemaining,
          action: acc.canAutoRefresh ? "REFRESH" : "REAUTH",
          canAutoRefresh: acc.canAutoRefresh,
        });
      } else if (acc.healthStatus === "EXPIRED") {
        expiredCount++;
        alerts.push({
          accountId: acc.accountId,
          platform: acc.platform,
          accountName: acc.accountName,
          severity: "CRITICAL",
          healthStatus: "EXPIRED",
          message: acc.message,
          daysRemaining: 0,
          action: acc.canAutoRefresh ? "REFRESH" : "REAUTH",
          canAutoRefresh: acc.canAutoRefresh,
        });
      } else if (acc.healthStatus === "NEEDS_REAUTH") {
        needsReauthCount++;
        alerts.push({
          accountId: acc.accountId,
          platform: acc.platform,
          accountName: acc.accountName,
          severity: "CRITICAL",
          healthStatus: "NEEDS_REAUTH",
          message: acc.message,
          daysRemaining: 0,
          action: "REAUTH",
          canAutoRefresh: false,
        });
      }
    }

    // Urutkan alert berdasarkan tingkat keparahan: CRITICAL dulu, baru WARNING
    alerts.sort((a, b) => {
      if (a.severity === "CRITICAL" && b.severity !== "CRITICAL") return -1;
      if (a.severity !== "CRITICAL" && b.severity === "CRITICAL") return 1;
      return (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0);
    });

    const actionRequiredCount = expiringSoonCount + expiredCount + needsReauthCount;

    let overallStatus: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
    if (expiredCount > 0 || needsReauthCount > 0) {
      overallStatus = "CRITICAL";
    } else if (expiringSoonCount > 0) {
      overallStatus = "WARNING";
    }

    return {
      totalAccounts: evaluatedAccounts.length,
      healthyCount,
      expiringSoonCount,
      expiredCount,
      needsReauthCount,
      actionRequiredCount,
      overallStatus,
      accounts: evaluatedAccounts,
      alerts,
    };
  }

  /**
   * Melakukan scan sistem untuk akun-akun yang mendekati masa kedaluwarsa
   * dan secara proaktif mendaftarkannya ke antrean refresh token.
   */
  async scanAndEnqueueExpiringTokens(
    thresholdDays: number = EXPIRATION_WARNING_DAYS
  ): Promise<{ scanned: number; enqueued: number }> {
    const thresholdTime = new Date(Date.now() + thresholdDays * 24 * 60 * 60 * 1000);
    const queue = getTokenRefreshQueue();

    const expiringAccounts = await db
      .select({
        id: connectedAccounts.id,
        userId: connectedAccounts.userId,
        platform: connectedAccounts.platform,
        tokenExpiresAt: connectedAccounts.tokenExpiresAt,
      })
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.status, "ACTIVE"),
          isNotNull(connectedAccounts.tokenExpiresAt),
          lt(connectedAccounts.tokenExpiresAt, thresholdTime)
        )
      );

    let enqueued = 0;
    for (const acc of expiringAccounts) {
      // Hanya enqueue platform yang mendukung refresh
      if (acc.platform === "TIKTOK" || acc.platform === "THREADS") {
        const windowId = Math.floor(Date.now() / (5 * 60 * 1000));
        const jobId = `refresh-proactive-${acc.id}-${windowId}`;

        await queue.add(
          `refresh-token-${acc.id}`,
          {
            accountId: acc.id,
            userId: acc.userId,
            platform: acc.platform,
          },
          {
            jobId,
            attempts: 3,
            backoff: {
              type: "fixed",
              delay: 5 * 60 * 1000,
            },
          }
        );
        enqueued++;
      }
    }

    return { scanned: expiringAccounts.length, enqueued };
  }

  /**
   * Melakukan refresh token secara proaktif untuk akun tertentu milik pengguna.
   */
  async refreshToken(
    userId: string,
    accountId: string
  ): Promise<{
    success: boolean;
    newExpiresAt?: Date;
    error?: string;
    health: AccountTokenHealth;
  }> {
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, userId)))
      .limit(1);

    if (!account) {
      throw new Error("Akun terhubung tidak ditemukan.");
    }

    const refreshResult = await platformConnector.refreshToken(accountId);

    // Ambil data akun terbaru setelah refresh
    const [updatedAccount] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, accountId))
      .limit(1);

    const latest = updatedAccount || account;
    const health = this.assessAccount(latest);

    return {
      success: refreshResult.success,
      newExpiresAt: refreshResult.newExpiresAt,
      error: refreshResult.error,
      health,
    };
  }
}

export const tokenHealthService = new TokenHealthService();
