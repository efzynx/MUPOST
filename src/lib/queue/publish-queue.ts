import { Queue } from "bullmq";
import { getRedisClient } from "@/lib/redis";

export const PUBLISH_QUEUE_NAME = "publish-queue";

export interface PublishJobData {
  postId: string;
  targetAccountIds?: string[];
  retryTargetId?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __mupost_publish_queue__: Queue<PublishJobData> | undefined;
}

/**
 * Membuat instance queue publish-queue dengan opsi default yang ditentukan dalam desain:
 * - attempts: 3
 * - exponential backoff mulai 60 detik (60_000 ms)
 */
export function createPublishQueue(
  customConnection?: ReturnType<typeof getRedisClient>
): Queue<PublishJobData> {
  const connection = customConnection ?? getRedisClient();

  return new Queue<PublishJobData>(PUBLISH_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 60_000, // 60 detik
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
}

/**
 * Mengambil singleton instance publish-queue.
 */
export function getPublishQueue(): Queue<PublishJobData> {
  if (!globalThis.__mupost_publish_queue__) {
    globalThis.__mupost_publish_queue__ = createPublishQueue();
  }
  return globalThis.__mupost_publish_queue__;
}

/**
 * Proxy singleton publishQueue untuk kemudahan export.
 */
export const publishQueue = new Proxy({} as Queue<PublishJobData>, {
  get(_target, prop: string | symbol) {
    const instance = getPublishQueue();
    const value = (instance as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
