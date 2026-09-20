import { Worker, type Job } from "bullmq";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { getRedisClient } from "@/lib/redis";
import {
  TOKEN_REFRESH_QUEUE_NAME,
  getTokenRefreshQueue,
  type TokenRefreshJobData,
} from "@/lib/queue/token-refresh-queue";
import { platformConnector } from "@/lib/services/platform-connector";

/**
 * Memindai database untuk akun aktif yang tokennya mendekati masa kedaluwarsa (< 24 jam)
 * dan memasukkannya ke antrean BullMQ token-refresh-queue.
 */
export async function scanAndEnqueueExpiringTokens(): Promise<number> {
  const thresholdTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam dari sekarang
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

  let enqueuedCount = 0;

  for (const acc of expiringAccounts) {
    // Deduplikasi job per window 5 menit
    const windowId = Math.floor(Date.now() / (5 * 60 * 1000));
    const jobId = `refresh-${acc.id}-${windowId}`;

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
          delay: 5 * 60 * 1000, // Interval 5 menit antar percobaan (Requirement 5.6)
        },
      }
    );

    enqueuedCount++;
  }

  return enqueuedCount;
}

/**
 * Logika eksekusi pembaruan token per job BullMQ.
 */
export async function processTokenRefreshJob(
  job: Job<TokenRefreshJobData>
): Promise<{ success: boolean; newExpiresAt?: Date; scannedCount?: number }> {
  // Tangani scan job terjadwal (recurring scanner tiap 1 jam)
  if (job.name === "scan-expiring-tokens" || (job.data as any)?.type === "scan-expiring-tokens") {
    const scannedCount = await scanAndEnqueueExpiringTokens();
    return { success: true, scannedCount };
  }

  const { accountId, platform } = job.data as { accountId: string; platform: any };

  const result = await platformConnector.refreshToken(accountId);

  if (!result.success) {
    const isFinalAttempt = job.attemptsMade >= 3;

    if (isFinalAttempt || result.error?.includes("Maksimal 3")) {
      // Tandai akun stale dan simpan notifikasi ke meta (Requirement 5.7 & 3.6)
      await platformConnector.markAccountStale(accountId);

      const [existing] = await db
        .select({ meta: connectedAccounts.meta })
        .from(connectedAccounts)
        .where(eq(connectedAccounts.id, accountId))
        .limit(1);

      const existingMeta = (existing?.meta as Record<string, unknown>) || {};

      await db
        .update(connectedAccounts)
        .set({
          meta: {
            ...existingMeta,
            notification: {
              type: "REAUTH_NEEDED",
              platform,
              message: `Koneksi akun ${platform} perlu diautentikasi ulang. Token kedaluwarsa dan gagal diperbarui secara otomatis.`,
              timestamp: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(connectedAccounts.id, accountId));
    }

    throw new Error(result.error || "Gagal melakukan refresh token.");
  }

  return { success: true, newExpiresAt: result.newExpiresAt };
}

/**
 * Mendaftarkan repeat job scanner ke antrean token refresh (tiap 1 jam).
 */
export async function setupTokenRefreshScanner(
  customQueue?: ReturnType<typeof getTokenRefreshQueue>
): Promise<void> {
  const queue = customQueue ?? getTokenRefreshQueue();
  if (typeof (queue as any).upsertJobScheduler === "function") {
    await (queue as any).upsertJobScheduler(
      "recurring-token-refresh-scanner",
      { every: 60 * 60 * 1000 },
      {
        name: "scan-expiring-tokens",
        data: { type: "scan-expiring-tokens" },
      }
    );
  } else {
    await (queue as any).add(
      "scan-expiring-tokens",
      { type: "scan-expiring-tokens" },
      {
        repeat: {
          every: 60 * 60 * 1000,
        },
        jobId: "recurring-token-refresh-scanner",
      }
    );
  }
}

let tokenRefreshWorkerInstance: Worker<TokenRefreshJobData> | null = null;

/**
 * Membuat instance BullMQ Worker untuk memproses proactive token refresh.
 */
export function createTokenRefreshWorker(
  customConnection?: ReturnType<typeof getRedisClient>
): Worker<TokenRefreshJobData> {
  const connection = customConnection ?? getRedisClient();

  const worker = new Worker<TokenRefreshJobData>(
    TOKEN_REFRESH_QUEUE_NAME,
    async (job) => processTokenRefreshJob(job),
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    if (job) {
      // eslint-disable-next-line no-console
      console.error(
        `[TokenRefreshWorker] Job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`
      );
    }
  });

  return worker;
}

export function getTokenRefreshWorker(): Worker<TokenRefreshJobData> {
  if (!tokenRefreshWorkerInstance) {
    tokenRefreshWorkerInstance = createTokenRefreshWorker();
  }
  return tokenRefreshWorkerInstance;
}

// Jalankan otomatis jika file dieksekusi langsung
if (require.main === module) {
  // eslint-disable-next-line no-console
  console.log("[TokenRefreshWorker] Memulai Token Refresh Worker...");
  getTokenRefreshWorker();
  setupTokenRefreshScanner().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[TokenRefreshWorker] Gagal setup recurring scanner:", err);
  });
}
