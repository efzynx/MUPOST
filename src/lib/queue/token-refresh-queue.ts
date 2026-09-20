import { Queue } from "bullmq";
import { getRedisClient } from "@/lib/redis";

export const TOKEN_REFRESH_QUEUE_NAME = "token-refresh-queue";

export interface TokenRefreshAccountJobData {
  type?: "refresh-account";
  accountId: string;
  userId: string;
  platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
}

export interface TokenRefreshScannerJobData {
  type: "scan-expiring-tokens";
  accountId?: never;
  userId?: never;
  platform?: never;
}

export type TokenRefreshJobData = TokenRefreshAccountJobData | TokenRefreshScannerJobData;

declare global {
  // eslint-disable-next-line no-var
  var __mupost_token_refresh_queue__: Queue<TokenRefreshJobData> | undefined;
}

/**
 * Membuat instance queue token-refresh-queue untuk proactive token refresh.
 * Sesuai requirement: maksimal 3 kali percobaan dengan interval 5 menit.
 */
export function createTokenRefreshQueue(
  customConnection?: ReturnType<typeof getRedisClient>
): Queue<TokenRefreshJobData> {
  const connection = customConnection ?? getRedisClient();

  return new Queue<TokenRefreshJobData>(TOKEN_REFRESH_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "fixed",
        delay: 5 * 60 * 1000, // 5 menit
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
}

/**
 * Mengambil singleton instance token-refresh-queue.
 */
export function getTokenRefreshQueue(): Queue<TokenRefreshJobData> {
  if (!globalThis.__mupost_token_refresh_queue__) {
    globalThis.__mupost_token_refresh_queue__ = createTokenRefreshQueue();
  }
  return globalThis.__mupost_token_refresh_queue__;
}

/**
 * Proxy singleton tokenRefreshQueue untuk kemudahan export.
 */
export const tokenRefreshQueue = new Proxy({} as Queue<TokenRefreshJobData>, {
  get(_target, prop: string | symbol) {
    const instance = getTokenRefreshQueue();
    const value = (instance as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
