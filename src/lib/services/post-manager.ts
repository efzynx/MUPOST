import { and, eq, desc, sql, inArray, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  posts,
  postTargets,
  connectedAccounts,
  type Post,
  type PostStatus,
  type PlatformType,
} from "@/lib/db/schema";
import { getPublishQueue, type PublishJobData } from "@/lib/queue/publish-queue";

// ==========================================
// Konstanta
// ==========================================

const MAX_TEXT_LENGTH = 5000;
const PAGE_SIZE = 20;

/** Minimum jarak waktu schedule dari sekarang (5 menit). */
const MIN_SCHEDULE_MS = 5 * 60 * 1000;
/** Maksimum jarak waktu schedule dari sekarang (365 hari). */
const MAX_SCHEDULE_MS = 365 * 24 * 60 * 60 * 1000;

/** Status yang tidak bisa diedit. */
const IMMUTABLE_STATUSES: PostStatus[] = ["PUBLISHED", "FAILED", "PARTIAL"];

// ==========================================
// Types
// ==========================================

export interface CreatePostInput {
  textContent: string;
  mediaUrls?: string[];
  targetAccountIds: string[];
  scheduledAt?: Date | null;
  /** Jika true, langsung publish (status → QUEUED). */
  publishNow?: boolean;
  source?: string;
}

export interface UpdatePostInput {
  textContent?: string;
  mediaUrls?: string[];
  targetAccountIds?: string[];
  scheduledAt?: Date | null;
}

export interface PostFilters {
  status?: PostStatus[];
  platform?: PlatformType[];
}

export interface PaginationInput {
  page: number;
}

export interface PostWithTargets extends Post {
  targets: Array<{
    id: string;
    connectedAccountId: string;
    platform: PlatformType;
    status: string;
    platformPostId: string | null;
    publishedAt: Date | null;
    errorCode: string | null;
    errorMessage: string | null;
    retryCount: number;
    accountName?: string;
  }>;
}

export interface ListPostsResult {
  posts: PostWithTargets[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==========================================
// Error
// ==========================================

export class PostManagerError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "PostManagerError";
  }
}

// ==========================================
// Service
// ==========================================

export class PostManagerService {
  /**
   * Buat post baru.
   *
   * - textContent wajib, maks 5000 karakter.
   * - targetAccountIds wajib, minimal 1.
   * - scheduledAt null → DRAFT (kecuali publishNow=true → QUEUED).
   * - scheduledAt di masa depan [+5min, +365d] → SCHEDULED.
   * - scheduledAt di luar range → ditolak.
   */
  async createPost(userId: string, data: CreatePostInput): Promise<PostWithTargets> {
    const errors: Record<string, string[]> = {};

    // Validasi textContent
    if (!data.textContent || data.textContent.trim().length === 0) {
      errors.textContent = ["Konten teks wajib diisi."];
    } else if (data.textContent.length > MAX_TEXT_LENGTH) {
      errors.textContent = [`Konten teks maksimal ${MAX_TEXT_LENGTH} karakter.`];
    }

    // Validasi targets
    if (!data.targetAccountIds || data.targetAccountIds.length === 0) {
      errors.targetAccountIds = ["Pilih minimal satu akun tujuan."];
    }

    if (Object.keys(errors).length > 0) {
      throw new PostManagerError("VALIDATION_ERROR", 400, "Data post tidak valid.", errors);
    }

    // Tentukan status berdasarkan scheduledAt
    let status: PostStatus = "DRAFT";
    let scheduledAt: Date | null = null;

    if (data.publishNow) {
      status = "QUEUED";
    } else if (data.scheduledAt) {
      const now = Date.now();
      const schedTime = new Date(data.scheduledAt).getTime();
      const diff = schedTime - now;

      if (diff < MIN_SCHEDULE_MS) {
        throw new PostManagerError(
          "INVALID_SCHEDULE",
          422,
          "Waktu jadwal harus minimal 5 menit dari sekarang."
        );
      }

      if (diff > MAX_SCHEDULE_MS) {
        throw new PostManagerError(
          "INVALID_SCHEDULE",
          422,
          "Waktu jadwal maksimal 365 hari dari sekarang."
        );
      }

      status = "SCHEDULED";
      scheduledAt = new Date(data.scheduledAt);
    }

    // Verifikasi semua target account milik user dan ACTIVE
    const accountRows = await db
      .select({
        id: connectedAccounts.id,
        platform: connectedAccounts.platform,
        status: connectedAccounts.status,
      })
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, userId),
          inArray(connectedAccounts.id, data.targetAccountIds)
        )
      );

    if (accountRows.length !== data.targetAccountIds.length) {
      throw new PostManagerError(
        "INVALID_TARGETS",
        400,
        "Satu atau lebih akun tujuan tidak ditemukan atau bukan milik Anda."
      );
    }

    const inactiveAccounts = accountRows.filter((a) => a.status !== "ACTIVE");
    if (inactiveAccounts.length > 0) {
      throw new PostManagerError(
        "INACTIVE_TARGETS",
        422,
        "Satu atau lebih akun tujuan tidak aktif. Hubungkan ulang terlebih dahulu."
      );
    }

    // INSERT post
    const [newPost] = await db
      .insert(posts)
      .values({
        userId,
        textContent: data.textContent.trim(),
        mediaUrls: data.mediaUrls ?? null,
        status,
        scheduledAt,
        source: data.source ?? "FORM",
      })
      .returning();

    if (!newPost) {
      throw new Error("Gagal membuat post.");
    }

    // INSERT post_targets
    const targetRows = accountRows.map((acc) => ({
      postId: newPost.id,
      connectedAccountId: acc.id,
      platform: acc.platform,
    }));

    const insertedTargets = await db.insert(postTargets).values(targetRows).returning();

    // Enqueue BullMQ job jika perlu
    let bullmqJobId: string | undefined;
    if (status === "QUEUED") {
      const queue = getPublishQueue();
      const job = await queue.add(
        `publish-${newPost.id}`,
        { postId: newPost.id } satisfies PublishJobData,
        { priority: 1 }
      );
      bullmqJobId = job?.id;
    } else if (status === "SCHEDULED" && scheduledAt) {
      const delay = scheduledAt.getTime() - Date.now();
      const queue = getPublishQueue();
      const job = await queue.add(
        `publish-${newPost.id}`,
        { postId: newPost.id } satisfies PublishJobData,
        { delay }
      );
      bullmqJobId = job?.id;
    }

    if (bullmqJobId) {
      const updatedMeta = {
        ...((newPost.meta as Record<string, unknown>) || {}),
        bullmq_job_id: bullmqJobId,
      };
      await db.update(posts).set({ meta: updatedMeta }).where(eq(posts.id, newPost.id));
      (newPost as any).meta = updatedMeta;
    }

    return {
      ...newPost,
      targets: insertedTargets.map((t) => ({
        id: t.id,
        connectedAccountId: t.connectedAccountId,
        platform: t.platform,
        status: t.status,
        platformPostId: t.platformPostId,
        publishedAt: t.publishedAt,
        errorCode: t.errorCode,
        errorMessage: t.errorMessage,
        retryCount: t.retryCount,
      })),
    };
  }

  /**
   * Update post yang sudah ada.
   *
   * - Verifikasi ownership.
   * - Tolak jika status PUBLISHED, FAILED, atau PARTIAL.
   */
  async updatePost(
    userId: string,
    postId: string,
    data: UpdatePostInput
  ): Promise<PostWithTargets> {
    const existing = await this.getPost(userId, postId);

    if (IMMUTABLE_STATUSES.includes(existing.status)) {
      throw new PostManagerError(
        "STATUS_LOCKED",
        422,
        `Post dengan status "${existing.status}" tidak dapat diedit.`
      );
    }

    // Validasi textContent jika disertakan
    if (data.textContent !== undefined) {
      if (data.textContent.trim().length === 0) {
        throw new PostManagerError("VALIDATION_ERROR", 400, "Konten teks tidak boleh kosong.");
      }
      if (data.textContent.length > MAX_TEXT_LENGTH) {
        throw new PostManagerError(
          "VALIDATION_ERROR",
          400,
          `Konten teks maksimal ${MAX_TEXT_LENGTH} karakter.`
        );
      }
    }

    // Validasi scheduledAt jika disertakan
    let newStatus = existing.status;
    let newScheduledAt = existing.scheduledAt;

    if (data.scheduledAt !== undefined) {
      if (data.scheduledAt === null) {
        newStatus = "DRAFT";
        newScheduledAt = null;
      } else {
        const now = Date.now();
        const schedTime = new Date(data.scheduledAt).getTime();
        const diff = schedTime - now;

        if (diff < MIN_SCHEDULE_MS) {
          throw new PostManagerError(
            "INVALID_SCHEDULE",
            422,
            "Waktu jadwal harus minimal 5 menit dari sekarang."
          );
        }
        if (diff > MAX_SCHEDULE_MS) {
          throw new PostManagerError(
            "INVALID_SCHEDULE",
            422,
            "Waktu jadwal maksimal 365 hari dari sekarang."
          );
        }

        newStatus = "SCHEDULED";
        newScheduledAt = new Date(data.scheduledAt);
      }
    }

    // UPDATE posts
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
      status: newStatus,
      scheduledAt: newScheduledAt,
    };
    if (data.textContent !== undefined) {
      updateValues.textContent = data.textContent.trim();
    }
    if (data.mediaUrls !== undefined) {
      updateValues.mediaUrls = data.mediaUrls;
    }

    await db
      .update(posts)
      .set(updateValues)
      .where(and(eq(posts.id, postId), eq(posts.userId, userId)));

    // Update targets jika disertakan
    if (data.targetAccountIds && data.targetAccountIds.length > 0) {
      // Hapus targets lama
      await db.delete(postTargets).where(eq(postTargets.postId, postId));

      // Verifikasi akun baru
      const accountRows = await db
        .select({
          id: connectedAccounts.id,
          platform: connectedAccounts.platform,
        })
        .from(connectedAccounts)
        .where(
          and(
            eq(connectedAccounts.userId, userId),
            inArray(connectedAccounts.id, data.targetAccountIds)
          )
        );

      if (accountRows.length !== data.targetAccountIds.length) {
        throw new PostManagerError(
          "INVALID_TARGETS",
          400,
          "Satu atau lebih akun tujuan tidak valid."
        );
      }

      await db.insert(postTargets).values(
        accountRows.map((acc) => ({
          postId,
          connectedAccountId: acc.id,
          platform: acc.platform,
        }))
      );
    }

    return this.getPost(userId, postId);
  }

  /**
   * Hapus post.
   *
   * - Verifikasi ownership.
   * - Jika status SCHEDULED, coba batalkan BullMQ delayed job.
   */
  async deletePost(userId: string, postId: string): Promise<void> {
    const existing = await this.getPost(userId, postId);

    // Coba batalkan BullMQ job jika SCHEDULED
    if (existing.status === "SCHEDULED") {
      try {
        const queue = getPublishQueue();
        const metaJobId = (existing.meta as Record<string, any>)?.bullmq_job_id;
        if (metaJobId) {
          try {
            await queue.remove(metaJobId);
          } catch {
            const job = await queue.getJob(metaJobId);
            if (job) {
              await job.remove();
            }
          }
        } else {
          const jobs = await queue.getDelayed();
          const matchingJob = jobs.find((j) => (j.data as PublishJobData).postId === postId);
          if (matchingJob) {
            await matchingJob.remove();
          }
        }
      } catch {
        // Tidak fatal jika gagal cancel — post tetap dihapus
      }
    }

    // DELETE posts (cascade ke post_targets via FK)
    const result = await db
      .delete(posts)
      .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
      .returning({ id: posts.id });

    if (result.length === 0) {
      throw new PostManagerError("NOT_FOUND", 404, "Post tidak ditemukan.");
    }
  }

  /**
   * Ambil satu post dengan targets.
   *
   * - Verifikasi ownership.
   */
  async getPost(userId: string, postId: string): Promise<PostWithTargets> {
    const [postRow] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
      .limit(1);

    if (!postRow) {
      throw new PostManagerError("NOT_FOUND", 404, "Post tidak ditemukan.");
    }

    const targets = await db
      .select({
        id: postTargets.id,
        connectedAccountId: postTargets.connectedAccountId,
        platform: postTargets.platform,
        status: postTargets.status,
        platformPostId: postTargets.platformPostId,
        publishedAt: postTargets.publishedAt,
        errorCode: postTargets.errorCode,
        errorMessage: postTargets.errorMessage,
        retryCount: postTargets.retryCount,
        accountName: connectedAccounts.accountName,
      })
      .from(postTargets)
      .leftJoin(connectedAccounts, eq(postTargets.connectedAccountId, connectedAccounts.id))
      .where(eq(postTargets.postId, postId));

    return {
      ...postRow,
      targets: targets.map((t) => ({
        ...t,
        accountName: t.accountName ?? undefined,
      })),
    };
  }

  /**
   * Daftar post dengan filter AND, urutan created_at DESC, dan paginasi.
   *
   * Filters:
   * - status[]: filter by post status (AND jika dikombinasikan)
   * - platform[]: filter by platform target (post yang punya minimal 1 target dengan platform ini)
   */
  async listPosts(
    userId: string,
    filters: PostFilters = {},
    pagination: PaginationInput = { page: 1 }
  ): Promise<ListPostsResult> {
    const page = Math.max(1, pagination.page);
    const offset = (page - 1) * PAGE_SIZE;

    // Build WHERE conditions
    const conditions: SQL[] = [eq(posts.userId, userId)];

    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(posts.status, filters.status));
    }

    // Platform filter: subquery — post yang punya target di platform tertentu
    if (filters.platform && filters.platform.length > 0) {
      conditions.push(
        sql`${posts.id} IN (
          SELECT DISTINCT ${postTargets.postId}
          FROM ${postTargets}
          WHERE ${inArray(postTargets.platform, filters.platform)}
        )`
      );
    }

    const whereClause = and(...conditions);

    // Count total
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    // Fetch posts
    const postRows = await db
      .select()
      .from(posts)
      .where(whereClause)
      .orderBy(desc(posts.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    // Fetch targets untuk semua post sekaligus
    const postIds = postRows.map((p) => p.id);
    let targetRows: Array<{
      id: string;
      postId: string;
      connectedAccountId: string;
      platform: PlatformType;
      status: string;
      platformPostId: string | null;
      publishedAt: Date | null;
      errorCode: string | null;
      errorMessage: string | null;
      retryCount: number;
      accountName: string | null;
    }> = [];

    if (postIds.length > 0) {
      targetRows = await db
        .select({
          id: postTargets.id,
          postId: postTargets.postId,
          connectedAccountId: postTargets.connectedAccountId,
          platform: postTargets.platform,
          status: postTargets.status,
          platformPostId: postTargets.platformPostId,
          publishedAt: postTargets.publishedAt,
          errorCode: postTargets.errorCode,
          errorMessage: postTargets.errorMessage,
          retryCount: postTargets.retryCount,
          accountName: connectedAccounts.accountName,
        })
        .from(postTargets)
        .leftJoin(connectedAccounts, eq(postTargets.connectedAccountId, connectedAccounts.id))
        .where(inArray(postTargets.postId, postIds));
    }

    // Group targets by postId
    const targetsByPostId = new Map<string, typeof targetRows>();
    for (const t of targetRows) {
      const arr = targetsByPostId.get(t.postId) ?? [];
      arr.push(t);
      targetsByPostId.set(t.postId, arr);
    }

    const postsWithTargets: PostWithTargets[] = postRows.map((p) => ({
      ...p,
      targets: (targetsByPostId.get(p.id) ?? []).map((t) => ({
        id: t.id,
        connectedAccountId: t.connectedAccountId,
        platform: t.platform,
        status: t.status,
        platformPostId: t.platformPostId,
        publishedAt: t.publishedAt,
        errorCode: t.errorCode,
        errorMessage: t.errorMessage,
        retryCount: t.retryCount,
        accountName: t.accountName ?? undefined,
      })),
    }));

    return {
      posts: postsWithTargets,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  }

  /**
   * Duplikasi post sebagai DRAFT baru.
   */
  async duplicatePost(userId: string, postId: string): Promise<PostWithTargets> {
    const existing = await this.getPost(userId, postId);

    return this.createPost(userId, {
      textContent: existing.textContent,
      mediaUrls: existing.mediaUrls ?? undefined,
      targetAccountIds: existing.targets.map((t) => t.connectedAccountId),
      scheduledAt: null,
      source: existing.source,
    });
  }

  /**
   * Jadwalkan retry untuk target yang gagal.
   *
   * - Cek retry_count < 3 pada post level.
   * - Enqueue publish job.
   */
  async scheduleRetry(userId: string, postId: string): Promise<void> {
    const existing = await this.getPost(userId, postId);

    if (existing.retryCount >= 3) {
      throw new PostManagerError(
        "RETRY_LIMIT",
        422,
        "Batas percobaan ulang (3 kali) telah tercapai."
      );
    }

    // Hanya retry jika ada target yang FAILED
    const failedTargets = existing.targets.filter((t) => t.status === "FAILED");
    if (failedTargets.length === 0) {
      throw new PostManagerError(
        "NO_FAILED_TARGETS",
        422,
        "Tidak ada target yang gagal untuk di-retry."
      );
    }

    // Update retry count dan status
    await db
      .update(posts)
      .set({
        retryCount: existing.retryCount + 1,
        status: "QUEUED",
        updatedAt: new Date(),
      })
      .where(and(eq(posts.id, postId), eq(posts.userId, userId)));

    // Enqueue job
    const queue = getPublishQueue();
    await queue.add(
      `publish-retry-${postId}-${existing.retryCount + 1}`,
      {
        postId,
        targetAccountIds: failedTargets.map((t) => t.connectedAccountId),
      } satisfies PublishJobData,
      { priority: 1 }
    );
  }

  /**
   * Set status post ke QUEUED dan enqueue BullMQ job untuk publish.
   */
  async publishNow(userId: string, postId: string): Promise<void> {
    const existing = await this.getPost(userId, postId);

    if (existing.status !== "DRAFT" && existing.status !== "SCHEDULED") {
      throw new PostManagerError(
        "INVALID_STATUS",
        422,
        `Post dengan status "${existing.status}" tidak dapat dipublikasikan.`
      );
    }

    // Jika SCHEDULED, cancel delayed job dulu
    if (existing.status === "SCHEDULED") {
      try {
        const queue = getPublishQueue();
        const metaJobId = (existing.meta as Record<string, any>)?.bullmq_job_id;
        if (metaJobId) {
          try {
            await queue.remove(metaJobId);
          } catch {
            const job = await queue.getJob(metaJobId);
            if (job) {
              await job.remove();
            }
          }
        } else {
          const jobs = await queue.getDelayed();
          const matchingJob = jobs.find((j) => (j.data as PublishJobData).postId === postId);
          if (matchingJob) {
            await matchingJob.remove();
          }
        }
      } catch {
        // Lanjut meski cancel gagal
      }
    }

    await db
      .update(posts)
      .set({
        status: "QUEUED",
        scheduledAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(posts.id, postId), eq(posts.userId, userId)));

    const queue = getPublishQueue();
    await queue.add(`publish-now-${postId}`, { postId } satisfies PublishJobData, { priority: 1 });
  }
}

export const postManager = new PostManagerService();
