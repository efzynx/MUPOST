import { eq, inArray } from "drizzle-orm";
import type { Job, JobType, Queue } from "bullmq";
import { getPublishQueue, PUBLISH_QUEUE_NAME } from "@/lib/queue/publish-queue";
import { getTokenRefreshQueue, TOKEN_REFRESH_QUEUE_NAME } from "@/lib/queue/token-refresh-queue";
import { db } from "@/lib/db";
import { posts, postTargets, connectedAccounts } from "@/lib/db/schema";
import { postManager } from "@/lib/services/post-manager";
import { publishPostEvent } from "@/lib/services/post-events";

export interface QueueCountMetrics {
  name: string;
  displayName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  total: number;
  isPaused: boolean;
}

export interface QueuesOverview {
  queues: Record<string, QueueCountMetrics>;
  summary: {
    totalWaiting: number;
    totalActive: number;
    totalCompleted: number;
    totalFailed: number;
    totalDelayed: number;
    totalJobs: number;
  };
  timestamp: string;
}

export interface SerializedQueueJob {
  id: string;
  name: string;
  queueName: string;
  state: string;
  data: Record<string, unknown>;
  attemptsMade: number;
  maxAttempts: number;
  failedReason: string | null;
  stacktrace: string[];
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  postDetails?: {
    id: string;
    textContent: string;
    status: string;
    targets: Array<{ platform: string; status: string }>;
  } | null;
}

export interface GetQueueJobsOptions {
  queueName?: string;
  types?: JobType[];
  page?: number;
  limit?: number;
}

export class QueueMonitorService {
  /**
   * Mengambil instance Queue berdasarkan nama.
   */
  getQueue(queueName: string): Queue | null {
    if (queueName === PUBLISH_QUEUE_NAME) {
      return getPublishQueue();
    }
    if (queueName === TOKEN_REFRESH_QUEUE_NAME) {
      return getTokenRefreshQueue();
    }
    return null;
  }

  /**
   * Mengambil metrik ringkasan untuk seluruh antrean BullMQ yang aktif.
   */
  async getOverviewMetrics(): Promise<QueuesOverview> {
    const publishQ = getPublishQueue();
    const tokenRefreshQ = getTokenRefreshQueue();

    const [publishCounts, publishPaused, tokenCounts, tokenPaused] = await Promise.all([
      publishQ.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
      publishQ.isPaused().catch(() => false),
      tokenRefreshQ.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
      tokenRefreshQ.isPaused().catch(() => false),
    ]);

    const publishMetrics: QueueCountMetrics = {
      name: PUBLISH_QUEUE_NAME,
      displayName: "Publish Worker Queue",
      waiting: publishCounts.waiting || 0,
      active: publishCounts.active || 0,
      completed: publishCounts.completed || 0,
      failed: publishCounts.failed || 0,
      delayed: publishCounts.delayed || 0,
      paused: publishCounts.paused || 0,
      total:
        (publishCounts.waiting || 0) +
        (publishCounts.active || 0) +
        (publishCounts.completed || 0) +
        (publishCounts.failed || 0) +
        (publishCounts.delayed || 0),
      isPaused: publishPaused,
    };

    const tokenMetrics: QueueCountMetrics = {
      name: TOKEN_REFRESH_QUEUE_NAME,
      displayName: "Token Refresh Worker Queue",
      waiting: tokenCounts.waiting || 0,
      active: tokenCounts.active || 0,
      completed: tokenCounts.completed || 0,
      failed: tokenCounts.failed || 0,
      delayed: tokenCounts.delayed || 0,
      paused: tokenCounts.paused || 0,
      total:
        (tokenCounts.waiting || 0) +
        (tokenCounts.active || 0) +
        (tokenCounts.completed || 0) +
        (tokenCounts.failed || 0) +
        (tokenCounts.delayed || 0),
      isPaused: tokenPaused,
    };

    return {
      queues: {
        [PUBLISH_QUEUE_NAME]: publishMetrics,
        [TOKEN_REFRESH_QUEUE_NAME]: tokenMetrics,
      },
      summary: {
        totalWaiting: publishMetrics.waiting + tokenMetrics.waiting,
        totalActive: publishMetrics.active + tokenMetrics.active,
        totalCompleted: publishMetrics.completed + tokenMetrics.completed,
        totalFailed: publishMetrics.failed + tokenMetrics.failed,
        totalDelayed: publishMetrics.delayed + tokenMetrics.delayed,
        totalJobs: publishMetrics.total + tokenMetrics.total,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Sanitasi data payload pekerjaan agar tidak mengekspos token atau rahasia.
   */
  private sanitizeJobData(data: Record<string, unknown>): Record<string, unknown> {
    if (!data || typeof data !== "object") return {};
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const lower = key.toLowerCase();
      if (
        lower.includes("token") ||
        lower.includes("secret") ||
        lower.includes("password") ||
        lower.includes("key")
      ) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Mengambil daftar job pada antrean tertentu dengan filter status dan pagination.
   */
  async getJobs(
    options: GetQueueJobsOptions = {}
  ): Promise<{ jobs: SerializedQueueJob[]; total: number; page: number; limit: number }> {
    const {
      queueName = PUBLISH_QUEUE_NAME,
      types = ["failed", "active", "waiting", "delayed", "completed"],
      page = 1,
      limit = 20,
    } = options;

    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" tidak ditemukan.`);
    }

    const start = (page - 1) * limit;
    const end = start + limit - 1;

    const rawJobs: Job[] = await queue.getJobs(types, start, end, false);

    // Ambil detail post secara batch jika ada job publish
    const postIds = new Set<string>();
    for (const j of rawJobs) {
      if (j.data?.postId && typeof j.data.postId === "string") {
        postIds.add(j.data.postId);
      }
    }

    const postDetailsMap = new Map<
      string,
      {
        id: string;
        textContent: string;
        status: string;
        targets: Array<{ platform: string; status: string }>;
      }
    >();

    if (postIds.size > 0) {
      try {
        const foundPosts = await db
          .select({
            id: posts.id,
            textContent: posts.textContent,
            status: posts.status,
          })
          .from(posts)
          .where(inArray(posts.id, Array.from(postIds)));

        const foundTargets = await db
          .select({
            postId: postTargets.postId,
            status: postTargets.status,
            platform: connectedAccounts.platform,
          })
          .from(postTargets)
          .leftJoin(connectedAccounts, eq(postTargets.connectedAccountId, connectedAccounts.id))
          .where(inArray(postTargets.postId, Array.from(postIds)));

        for (const p of foundPosts) {
          const targets = foundTargets
            .filter((t) => t.postId === p.id)
            .map((t) => ({
              platform: t.platform || "UNKNOWN",
              status: t.status,
            }));

          postDetailsMap.set(p.id, {
            id: p.id,
            textContent:
              p.textContent.length > 80 ? `${p.textContent.slice(0, 80)}...` : p.textContent,
            status: p.status,
            targets,
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[QueueMonitor] Gagal memuat detail post terkait job:", err);
      }
    }

    const serializedJobs: SerializedQueueJob[] = await Promise.all(
      rawJobs.map(async (j) => {
        let state = "unknown";
        try {
          state = await j.getState();
        } catch {
          // ignore
        }

        const postId = j.data?.postId as string | undefined;

        return {
          id: String(j.id),
          name: j.name,
          queueName,
          state,
          data: this.sanitizeJobData(j.data || {}),
          attemptsMade: j.attemptsMade || 0,
          maxAttempts: j.opts?.attempts || 1,
          failedReason: j.failedReason || null,
          stacktrace: Array.isArray(j.stacktrace) ? j.stacktrace : [],
          timestamp: j.timestamp || 0,
          processedOn: j.processedOn || null,
          finishedOn: j.finishedOn || null,
          postDetails: postId ? postDetailsMap.get(postId) || null : null,
        };
      })
    );

    return {
      jobs: serializedJobs,
      total: serializedJobs.length,
      page,
      limit,
    };
  }

  /**
   * Melakukan retry pada job tertentu yang gagal.
   */
  async retryJob(
    queueName: string,
    jobId: string,
    _userId?: string
  ): Promise<{ success: boolean; message: string; jobId: string }> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" tidak ditemukan.`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job "${jobId}" tidak ditemukan di antrean.`);
    }

    await job.retry("failed");

    // Jika job publish memiliki postId, perbarui status post di DB jika saat ini FAILED
    const postId = job.data?.postId;
    if (postId && typeof postId === "string") {
      try {
        const [post] = await db
          .select({ status: posts.status, userId: posts.userId })
          .from(posts)
          .where(eq(posts.id, postId))
          .limit(1);

        if (post && (post.status === "FAILED" || post.status === "PARTIAL")) {
          await db
            .update(posts)
            .set({
              status: "QUEUED",
              updatedAt: new Date(),
            })
            .where(eq(posts.id, postId));

          await publishPostEvent({
            type: "POST_STATUS_CHANGED",
            postId,
            userId: post.userId,
            status: "QUEUED",
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[QueueMonitor] Gagal memperbarui status post saat retry job:", err);
      }
    }

    return {
      success: true,
      jobId,
      message: `Job ${jobId} berhasil dimasukkan kembali ke antrean untuk diproses ulang.`,
    };
  }

  /**
   * Melakukan retry pada seluruh job gagal di antrean tertentu atau seluruh antrean.
   */
  async retryAllFailed(
    queueName?: string
  ): Promise<{ success: boolean; count: number; message: string }> {
    const queuesToRetry: Queue[] = [];

    if (queueName) {
      const q = this.getQueue(queueName);
      if (!q) throw new Error(`Queue "${queueName}" tidak ditemukan.`);
      queuesToRetry.push(q);
    } else {
      queuesToRetry.push(getPublishQueue(), getTokenRefreshQueue());
    }

    let totalRetried = 0;

    for (const q of queuesToRetry) {
      try {
        if (typeof q.retryJobs === "function") {
          await q.retryJobs({ count: 100 });
          totalRetried += 1;
        } else {
          const failedJobs = await q.getFailed();
          for (const j of failedJobs) {
            await j.retry("failed");
            totalRetried++;
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[QueueMonitor] Gagal retryAll pada queue ${q.name}:`, err);
      }
    }

    return {
      success: true,
      count: totalRetried,
      message: "Proses retry seluruh job yang gagal telah dijalankan.",
    };
  }

  /**
   * Melakukan retry pada postingan yang gagal melalui postManager.
   */
  async retryFailedPost(
    userId: string,
    postId: string
  ): Promise<{ success: boolean; postId: string; message: string }> {
    await postManager.scheduleRetry(userId, postId);
    return {
      success: true,
      postId,
      message: `Postingan ${postId} berhasil dijadwalkan ulang untuk dicoba kembali.`,
    };
  }
}

export const queueMonitorService = new QueueMonitorService();
