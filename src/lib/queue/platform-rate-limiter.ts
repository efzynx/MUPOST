import type Redis from "ioredis";
import { type PlatformType } from "@/lib/db/schema";
import { getRedisClient } from "@/lib/redis";

// ==========================================
// Types & Defaults
// ==========================================

export interface PlatformRateLimitConfig {
  /** Maksimal jumlah request dalam satu time window */
  maxRequests: number;
  /** Durasi window dalam milidetik (default: 60_000 ms = 1 menit) */
  windowMs: number;
  /** Interval minimum antar-request ke platform yang sama untuk job throttling (ms) */
  minIntervalMs: number;
}

export const DEFAULT_PLATFORM_RATE_LIMITS: Record<PlatformType, PlatformRateLimitConfig> = {
  META_PAGE: {
    maxRequests: 50,
    windowMs: 60_000,
    minIntervalMs: 200,
  },
  INSTAGRAM: {
    maxRequests: 25,
    windowMs: 60_000,
    minIntervalMs: 500,
  },
  TIKTOK: {
    maxRequests: 20,
    windowMs: 60_000,
    minIntervalMs: 500,
  },
  THREADS: {
    maxRequests: 30,
    windowMs: 60_000,
    minIntervalMs: 300,
  },
};

export const DEFAULT_BACKOFF_CONFIG = {
  baseDelayMs: 60_000, // 60 detik (1 menit)
  maxDelayMs: 300_000, // 5 menit
};

// ==========================================
// Custom Error Class
// ==========================================

export class PlatformRateLimitError extends Error {
  platform: PlatformType;
  retryAfterMs?: number;
  isRateLimited = true;

  constructor(message: string, platform: PlatformType, retryAfterMs?: number) {
    super(message);
    this.name = "PlatformRateLimitError";
    this.platform = platform;
    this.retryAfterMs = retryAfterMs;
  }
}

// ==========================================
// Helper: Extract Rate Limit Info
// ==========================================

export interface RateLimitInfo {
  isRateLimited: boolean;
  errorCode?: string;
  errorMessage?: string;
  retryAfterMs?: number;
}

/**
 * Mendeteksi apakah respon dari platform sosial media mengindikasikan rate limit (429, kuota habis, dsb).
 */
export function extractRateLimitInfo(
  res?: { status?: number; headers?: Headers | { get?: (k: string) => string | null } } | null,
  json?: unknown
): RateLimitInfo {
  const status = res?.status;
  const jsonRecord = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const err = (
    jsonRecord.error && typeof jsonRecord.error === "object" ? jsonRecord.error : {}
  ) as Record<string, unknown>;

  const code = String(err.code || jsonRecord.code || status || "");
  const message = String(err.message || jsonRecord.message || jsonRecord.error_message || "");
  const subcode = err.error_subcode || jsonRecord.error_subcode;

  const isRateLimited =
    status === 429 ||
    code === "429" ||
    code === "4" || // Meta: Application request limit reached
    code === "17" || // Meta: User request limit reached
    code === "32" || // Meta: Page request limit reached
    code === "613" || // Meta: Custom rate limit reached
    code === "80004" || // Meta: Too many calls to this account
    code === "rate_limit_exceeded" || // TikTok
    code === "spam_risk_too_many_pending_share" || // TikTok
    subcode === 2446079 ||
    message.toLowerCase().includes("rate limit") ||
    message.toLowerCase().includes("too many requests") ||
    message.toLowerCase().includes("request limit reached") ||
    message.toLowerCase().includes("quota exceeded");

  let retryAfterMs: number | undefined;
  try {
    const headerVal = res?.headers?.get?.("retry-after");
    if (headerVal) {
      const parsed = parseInt(headerVal, 10);
      if (!isNaN(parsed) && parsed > 0) {
        retryAfterMs = parsed * 1000;
      }
    }
  } catch {
    // Abaikan error parsing header
  }

  return {
    isRateLimited,
    errorCode: isRateLimited ? code || "429" : undefined,
    errorMessage: isRateLimited
      ? message || "Rate limit terlampaui (Too Many Requests)"
      : undefined,
    retryAfterMs,
  };
}

// ==========================================
// Helper: Exponential Backoff Calculator
// ==========================================

/**
 * Menghitung waktu tunda (delay) retry berbasis exponential backoff:
 * - Percobaan 1: 1 * baseDelay (contoh: 1 menit)
 * - Percobaan 2: 2 * baseDelay (contoh: 2 menit)
 * - Percobaan 3: 4 * baseDelay (contoh: 4 menit)
 * Jika `err.retryAfterMs` tersedia dan lebih besar, gunakan nilai tersebut.
 */
export function calculateRateLimitBackoff(
  attemptsMade: number,
  err?: Error | (Error & { retryAfterMs?: number }),
  baseDelayMs: number = DEFAULT_BACKOFF_CONFIG.baseDelayMs
): number {
  const retryAfterMs = (err as Record<string, unknown> | undefined)?.retryAfterMs;
  const exponential = Math.pow(2, Math.max(0, attemptsMade - 1)) * baseDelayMs;

  if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
    return Math.max(retryAfterMs, exponential);
  }

  return Math.min(exponential, DEFAULT_BACKOFF_CONFIG.maxDelayMs);
}

// ==========================================
// Platform Rate Limiter & Throttler Service
// ==========================================

export class PlatformRateLimiter {
  private configs: Record<PlatformType, PlatformRateLimitConfig>;
  private customRedis?: Redis;

  // In-memory fallback jika Redis tidak tersedia atau di environment unit test
  private memoryWindows = new Map<string, number[]>();
  private memoryLocks = new Map<string, number>();
  private memoryLastRequest = new Map<string, number>();

  constructor(
    customRedis?: Redis,
    customConfigs?: Partial<Record<PlatformType, Partial<PlatformRateLimitConfig>>>
  ) {
    this.customRedis = customRedis;
    this.configs = {
      META_PAGE: { ...DEFAULT_PLATFORM_RATE_LIMITS.META_PAGE, ...customConfigs?.META_PAGE },
      INSTAGRAM: { ...DEFAULT_PLATFORM_RATE_LIMITS.INSTAGRAM, ...customConfigs?.INSTAGRAM },
      TIKTOK: { ...DEFAULT_PLATFORM_RATE_LIMITS.TIKTOK, ...customConfigs?.TIKTOK },
      THREADS: { ...DEFAULT_PLATFORM_RATE_LIMITS.THREADS, ...customConfigs?.THREADS },
    };
  }

  private getRedis(): Redis | null {
    if (this.customRedis) return this.customRedis;
    try {
      return getRedisClient();
    } catch {
      return null;
    }
  }

  public getConfig(platform: PlatformType): PlatformRateLimitConfig {
    return this.configs[platform] || DEFAULT_PLATFORM_RATE_LIMITS[platform];
  }

  public setConfig(platform: PlatformType, config: Partial<PlatformRateLimitConfig>): void {
    this.configs[platform] = {
      ...this.getConfig(platform),
      ...config,
    };
  }

  /**
   * Cek apakah platform sedang terkunci (misal setelah menerima status 429).
   */
  public async isLocked(
    platform: PlatformType,
    accountId?: string
  ): Promise<{ locked: boolean; retryAfterMs: number }> {
    const key = `rate_limit:locked:${platform}:${accountId || "global"}`;
    const now = Date.now();

    const redis = this.getRedis();
    if (redis) {
      try {
        const val = await redis.get(key);
        if (val) {
          const expiry = parseInt(val, 10);
          if (expiry > now) {
            return { locked: true, retryAfterMs: expiry - now };
          }
        }
      } catch {
        // Fallback to in-memory
      }
    }

    const memExpiry = this.memoryLocks.get(key);
    if (memExpiry && memExpiry > now) {
      return { locked: true, retryAfterMs: memExpiry - now };
    }

    return { locked: false, retryAfterMs: 0 };
  }

  /**
   * Mengunci platform untuk durasi tertentu saat menerima error 429 atau kuota habis.
   */
  public async recordRateLimitHit(
    platform: PlatformType,
    retryAfterMs = 60_000,
    accountId?: string
  ): Promise<void> {
    const key = `rate_limit:locked:${platform}:${accountId || "global"}`;
    const ttl = Math.max(retryAfterMs, 1000);
    const expiry = Date.now() + ttl;

    this.memoryLocks.set(key, expiry);

    const redis = this.getRedis();
    if (redis) {
      try {
        await redis.set(key, expiry.toString(), "PX", ttl);
      } catch {
        // Fallback to in-memory already set
      }
    }
  }

  /**
   * Memeriksa kuota rate limit (sliding window counter) tanpa mengonsumsi kuota.
   */
  public async checkLimit(
    platform: PlatformType,
    accountId?: string
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const lockCheck = await this.isLocked(platform, accountId);
    if (lockCheck.locked) {
      return { allowed: false, remaining: 0, resetMs: lockCheck.retryAfterMs };
    }

    const cfg = this.getConfig(platform);
    const key = `rate_limit:window:${platform}:${accountId || "global"}`;
    const now = Date.now();
    const windowStart = now - cfg.windowMs;

    const redis = this.getRedis();
    if (redis) {
      try {
        await redis.zremrangebyscore(key, 0, windowStart);
        const count = await redis.zcard(key);
        if (count >= cfg.maxRequests) {
          return { allowed: false, remaining: 0, resetMs: cfg.windowMs };
        }
        return { allowed: true, remaining: Math.max(0, cfg.maxRequests - count), resetMs: 0 };
      } catch {
        // Fallback to in-memory
      }
    }

    const existing = (this.memoryWindows.get(key) || []).filter((t) => t > windowStart);
    this.memoryWindows.set(key, existing);

    if (existing.length >= cfg.maxRequests) {
      return { allowed: false, remaining: 0, resetMs: cfg.windowMs };
    }

    return { allowed: true, remaining: Math.max(0, cfg.maxRequests - existing.length), resetMs: 0 };
  }

  /**
   * Mengonsumsi 1 kuota request dari sliding window platform.
   */
  public async consume(
    platform: PlatformType,
    accountId?: string
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const check = await this.checkLimit(platform, accountId);
    if (!check.allowed) {
      return check;
    }

    const cfg = this.getConfig(platform);
    const key = `rate_limit:window:${platform}:${accountId || "global"}`;
    const now = Date.now();

    const redis = this.getRedis();
    if (redis) {
      try {
        await redis.zadd(key, now, `${now}-${Math.random()}`);
        await redis.pexpire(key, cfg.windowMs);
      } catch {
        // Fallback to in-memory
      }
    }

    const existing = this.memoryWindows.get(key) || [];
    existing.push(now);
    this.memoryWindows.set(key, existing);

    return {
      allowed: true,
      remaining: Math.max(0, check.remaining - 1),
      resetMs: 0,
    };
  }

  /**
   * Job Throttling: Menjeda eksekusi jika request ke platform yang sama terjadi terlalu berdekatan.
   */
  public async throttle(platform: PlatformType, accountId?: string): Promise<number> {
    const cfg = this.getConfig(platform);
    if (cfg.minIntervalMs <= 0) return 0;

    const key = `throttle:platform:${platform}:${accountId || "global"}`;
    const now = Date.now();

    let lastTs = this.memoryLastRequest.get(key) || 0;

    const redis = this.getRedis();
    if (redis) {
      try {
        const val = await redis.get(key);
        if (val) {
          lastTs = Math.max(lastTs, parseInt(val, 10));
        }
      } catch {
        // Gunakan memoryLastRequest
      }
    }

    const elapsed = now - lastTs;
    let waitTime = 0;

    if (elapsed < cfg.minIntervalMs && lastTs > 0) {
      waitTime = cfg.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    const newTs = Date.now();
    this.memoryLastRequest.set(key, newTs);

    if (redis) {
      try {
        await redis.set(key, newTs.toString(), "PX", cfg.minIntervalMs * 10);
      } catch {
        // Abaikan error redis
      }
    }

    return waitTime;
  }

  /**
   * Mengamankan slot eksekusi: Cek lock, cek limit, terapkan throttling, lalu konsumsi kuota.
   * Melempar `PlatformRateLimitError` jika tidak diizinkan.
   */
  public async acquire(platform: PlatformType, accountId?: string): Promise<void> {
    const lock = await this.isLocked(platform, accountId);
    if (lock.locked) {
      throw new PlatformRateLimitError(
        `Platform ${platform} sedang dalam masa rate limit lock (${Math.ceil(lock.retryAfterMs / 1000)}s tersisa)`,
        platform,
        lock.retryAfterMs
      );
    }

    const limit = await this.checkLimit(platform, accountId);
    if (!limit.allowed) {
      throw new PlatformRateLimitError(
        `Rate limit kuota tercapai untuk platform ${platform} (reset dalam ${Math.ceil(limit.resetMs / 1000)}s)`,
        platform,
        limit.resetMs
      );
    }

    await this.throttle(platform, accountId);
    await this.consume(platform, accountId);
  }

  /**
   * Reset seluruh pencatatan window, lock, dan throttle (berguna untuk testing).
   */
  public async reset(platform?: PlatformType): Promise<void> {
    if (platform) {
      Array.from(this.memoryWindows.keys()).forEach((k) => {
        if (k.includes(platform)) this.memoryWindows.delete(k);
      });
      Array.from(this.memoryLocks.keys()).forEach((k) => {
        if (k.includes(platform)) this.memoryLocks.delete(k);
      });
      Array.from(this.memoryLastRequest.keys()).forEach((k) => {
        if (k.includes(platform)) this.memoryLastRequest.delete(k);
      });
    } else {
      this.memoryWindows.clear();
      this.memoryLocks.clear();
      this.memoryLastRequest.clear();
    }
  }
}

// Singleton platformRateLimiter instance
export const platformRateLimiter = new PlatformRateLimiter();
