import Redis, { type RedisOptions } from "ioredis";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __mupost_redis__: Redis | undefined;
}

/**
 * Menghasilkan opsi standar koneksi Redis yang kompatibel dengan BullMQ dan ioredis.
 */
export function getRedisOptions(overrideOptions?: Partial<RedisOptions>): RedisOptions {
  return {
    maxRetriesPerRequest: null, // Wajib null untuk BullMQ
    enableReadyCheck: false,
    retryStrategy(times: number) {
      // Exponential backoff dengan limit maksimal 3000ms
      return Math.min(times * 100, 3000);
    },
    ...overrideOptions,
  };
}

/**
 * Membuat instance baru Redis Client (berguna untuk Worker atau subscriber terpisah).
 */
export function createRedisClient(overrideOptions?: Partial<RedisOptions>): Redis {
  const options = getRedisOptions(overrideOptions);
  const client = new Redis(env.REDIS_URL, options);

  client.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[Redis Error]:", err.message);
  });

  return client;
}

/**
 * Mengambil singleton Redis client untuk menghindari kebocoran koneksi saat Next.js hot reload.
 */
export function getRedisClient(): Redis {
  if (process.env.NODE_ENV === "production") {
    if (!globalThis.__mupost_redis__) {
      globalThis.__mupost_redis__ = createRedisClient();
    }
    return globalThis.__mupost_redis__;
  }

  if (!globalThis.__mupost_redis__) {
    globalThis.__mupost_redis__ = createRedisClient();
  }
  return globalThis.__mupost_redis__;
}

/**
 * Proxy singleton redis untuk kemudahan penggunaan di seluruh aplikasi.
 */
export const redis = new Proxy({} as Redis, {
  get(_target, prop: string | symbol) {
    const instance = getRedisClient();
    const value = (instance as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
