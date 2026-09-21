import { EventEmitter } from "events";
import { getRedisClient } from "@/lib/redis";
import type { PostStatus, PlatformType } from "@/lib/db/schema";

export type PostEventType = "POST_STATUS_CHANGED" | "POST_CREATED" | "POST_DELETED";

export interface TargetStatusSummary {
  id: string;
  platform: PlatformType;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  publishedAt?: Date | string | null;
}

export interface PostStatusEvent {
  type: PostEventType;
  postId: string;
  userId: string;
  status: PostStatus;
  publishedAt?: Date | string | null;
  scheduledAt?: Date | string | null;
  targets?: TargetStatusSummary[];
  timestamp: string;
}

export const POST_EVENTS_GLOBAL_CHANNEL = "posts:events";

export function getPostEventsChannel(userId: string): string {
  return `user:${userId}:posts:events`;
}

// In-process event emitter for local tests and single-process fallback
export const localPostEvents = new EventEmitter();

/**
 * Mempublikasikan event status postingan ke Redis Pub/Sub dan local EventEmitter.
 */
export async function publishPostEvent(
  event: Omit<PostStatusEvent, "timestamp"> & { timestamp?: string }
): Promise<void> {
  const fullEvent: PostStatusEvent = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  // 1. Emit secara lokal (in-process)
  try {
    localPostEvents.emit("event", fullEvent);
    localPostEvents.emit(`user:${fullEvent.userId}`, fullEvent);
  } catch {
    // Abaikan error lokal
  }

  // 2. Publish ke Redis Pub/Sub untuk komunikasi lintas proses (Worker <-> Next.js API)
  try {
    const redisClient = getRedisClient();
    const payloadStr = JSON.stringify(fullEvent);
    await Promise.allSettled([
      redisClient.publish(getPostEventsChannel(fullEvent.userId), payloadStr),
      redisClient.publish(POST_EVENTS_GLOBAL_CHANNEL, payloadStr),
    ]);
  } catch (err: any) {
    // Non-fatal: hanya peringatan agar proses worker atau API tidak gagal jika Redis PubSub bermasalah
    // eslint-disable-next-line no-console
    console.warn("[PostEvents] Gagal publish event ke Redis:", err?.message || err);
  }
}
