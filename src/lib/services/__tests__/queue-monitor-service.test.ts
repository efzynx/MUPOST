import { QueueMonitorService } from "../queue-monitor-service";
import { getPublishQueue } from "@/lib/queue/publish-queue";
import { getTokenRefreshQueue } from "@/lib/queue/token-refresh-queue";
import { postManager } from "@/lib/services/post-manager";
import { GET as getQueuesRoute } from "@/app/api/admin/queues/route";
import { POST as retryQueueRoute } from "@/app/api/admin/queues/retry/route";
import { authService } from "@/lib/services/auth-service";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";

// Mocks
jest.mock("@/lib/queue/publish-queue", () => ({
  PUBLISH_QUEUE_NAME: "publish-queue",
  getPublishQueue: jest.fn(),
}));

jest.mock("@/lib/queue/token-refresh-queue", () => ({
  TOKEN_REFRESH_QUEUE_NAME: "token-refresh-queue",
  getTokenRefreshQueue: jest.fn(),
}));

jest.mock("@/lib/services/post-manager", () => ({
  postManager: {
    scheduleRetry: jest.fn(),
  },
  PostManagerError: class PostManagerError extends Error {
    constructor(
      public code: string,
      public statusCode: number,
      message: string
    ) {
      super(message);
    }
  },
}));

jest.mock("@/lib/services/post-events", () => ({
  publishPostEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/services/auth-service", () => ({
  authService: {
    validateSession: jest.fn(),
  },
}));

jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
  },
}));

describe("QueueMonitorService & BullMQ Observability", () => {
  const service = new QueueMonitorService();

  const mockPublishQueue = {
    name: "publish-queue",
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 2,
      active: 1,
      completed: 10,
      failed: 3,
      delayed: 0,
    }),
    isPaused: jest.fn().mockResolvedValue(false),
    getJobs: jest.fn(),
    getJob: jest.fn(),
    retryJobs: jest.fn().mockResolvedValue(undefined),
    getFailedCount: jest.fn().mockResolvedValue(3),
    getFailed: jest.fn().mockResolvedValue([]),
  };

  const mockTokenRefreshQueue = {
    name: "token-refresh-queue",
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 5,
      failed: 1,
      delayed: 0,
    }),
    isPaused: jest.fn().mockResolvedValue(false),
    getJobs: jest.fn(),
    getJob: jest.fn(),
    retryJobs: jest.fn().mockResolvedValue(undefined),
    getFailedCount: jest.fn().mockResolvedValue(1),
    getFailed: jest.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getPublishQueue as jest.Mock).mockReturnValue(mockPublishQueue);
    (getTokenRefreshQueue as jest.Mock).mockReturnValue(mockTokenRefreshQueue);
  });

  describe("getOverviewMetrics", () => {
    it("should compute correct aggregated metrics across all queues", async () => {
      const overview = await service.getOverviewMetrics();

      expect(overview.queues["publish-queue"]).toBeDefined();
      expect(overview.queues["publish-queue"]!.waiting).toBe(2);
      expect(overview.queues["publish-queue"]!.active).toBe(1);
      expect(overview.queues["publish-queue"]!.completed).toBe(10);
      expect(overview.queues["publish-queue"]!.failed).toBe(3);
      expect(overview.queues["publish-queue"]!.total).toBe(16);

      expect(overview.queues["token-refresh-queue"]).toBeDefined();
      expect(overview.queues["token-refresh-queue"]!.failed).toBe(1);

      expect(overview.summary.totalWaiting).toBe(2);
      expect(overview.summary.totalActive).toBe(1);
      expect(overview.summary.totalCompleted).toBe(15);
      expect(overview.summary.totalFailed).toBe(4);
      expect(overview.summary.totalJobs).toBe(22);
    });
  });

  describe("getJobs", () => {
    it("should retrieve and sanitize jobs with redaction of secrets", async () => {
      const mockJob = {
        id: "job-101",
        name: "publish-job",
        data: {
          postId: "post-123",
          secretToken: "super-secret-oauth-token",
          normalField: "visible",
        },
        attemptsMade: 2,
        opts: { attempts: 3 },
        failedReason: "Platform API Error 500",
        stacktrace: ["Error: fail", "at step 1"],
        timestamp: 1700000000000,
        processedOn: 1700000005000,
        finishedOn: 1700000010000,
        getState: jest.fn().mockResolvedValue("failed"),
      };

      mockPublishQueue.getJobs.mockResolvedValue([mockJob]);

      // Mock database call for post detail
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest
            .fn()
            .mockResolvedValue([
              { id: "post-123", textContent: "Halo dunia konten", status: "FAILED" },
            ]),
          leftJoin: jest.fn().mockReturnValue({
            where: jest
              .fn()
              .mockResolvedValue([{ postId: "post-123", status: "FAILED", platform: "THREADS" }]),
          }),
        }),
      });

      const result = await service.getJobs({
        queueName: "publish-queue",
        types: ["failed"],
        page: 1,
        limit: 10,
      });

      expect(result.jobs).toHaveLength(1);
      const job = result.jobs[0]!;
      expect(job.id).toBe("job-101");
      expect(job.state).toBe("failed");
      expect(job.failedReason).toBe("Platform API Error 500");

      // Verifikasi token rahasia telah disensor
      expect(job.data.secretToken).toBe("[REDACTED]");
      expect(job.data.normalField).toBe("visible");
      expect(job.data.postId).toBe("post-123");
    });
  });

  describe("retryJob", () => {
    it("should call job.retry('failed') and update DB status if post is FAILED", async () => {
      const mockJob = {
        id: "job-55",
        data: { postId: "post-55" },
        retry: jest.fn().mockResolvedValue(undefined),
      };

      mockPublishQueue.getJob.mockResolvedValue(mockJob);

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ status: "FAILED", userId: "user-9" }]),
          }),
        }),
      });

      (db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const res = await service.retryJob("publish-queue", "job-55");

      expect(mockJob.retry).toHaveBeenCalledWith("failed");
      expect(res.success).toBe(true);
      expect(res.jobId).toBe("job-55");
    });

    it("should throw error if job is not found", async () => {
      mockPublishQueue.getJob.mockResolvedValue(null);

      await expect(service.retryJob("publish-queue", "non-existent")).rejects.toThrow(
        'Job "non-existent" tidak ditemukan di antrean.'
      );
    });
  });

  describe("retryAllFailed", () => {
    it("should trigger retryJobs on queue", async () => {
      const res = await service.retryAllFailed("publish-queue");

      expect(mockPublishQueue.retryJobs).toHaveBeenCalledWith({ count: 100 });
      expect(res.success).toBe(true);
      expect(res.count).toBe(1);
    });
  });

  describe("retryFailedPost", () => {
    it("should delegate to postManager.scheduleRetry", async () => {
      (postManager.scheduleRetry as jest.Mock).mockResolvedValue(undefined);

      const res = await service.retryFailedPost("user-1", "post-99");

      expect(postManager.scheduleRetry).toHaveBeenCalledWith("user-1", "post-99");
      expect(res.success).toBe(true);
      expect(res.postId).toBe("post-99");
    });
  });

  describe("API Routes for Queue Observability", () => {
    it("GET /api/admin/queues rejects request without session (401)", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/queues");
      const res = await getQueuesRoute(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("GET /api/admin/queues returns metrics when authenticated", async () => {
      (authService.validateSession as jest.Mock).mockResolvedValue({
        id: "admin-user",
        fullName: "Admin",
      });

      mockPublishQueue.getJobs.mockResolvedValue([]);

      const req = new NextRequest("http://localhost:3000/api/admin/queues?queue=publish-queue", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=valid-cookie`,
        },
      });

      const res = await getQueuesRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.metrics).toBeDefined();
      expect(json.summary).toBeDefined();
      expect(json.jobs).toBeDefined();
    });

    it("POST /api/admin/queues/retry rejects invalid parameters with 400", async () => {
      (authService.validateSession as jest.Mock).mockResolvedValue({
        id: "admin-user",
        fullName: "Admin",
      });

      const req = new NextRequest("http://localhost:3000/api/admin/queues/retry", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=valid-cookie`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await retryQueueRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("BAD_REQUEST");
    });

    it("POST /api/admin/queues/retry handles postId retry successfully", async () => {
      (authService.validateSession as jest.Mock).mockResolvedValue({
        id: "user-retry",
        fullName: "User Retry",
      });

      (postManager.scheduleRetry as jest.Mock).mockResolvedValue(undefined);

      const req = new NextRequest("http://localhost:3000/api/admin/queues/retry", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=valid-cookie`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ postId: "post-to-retry" }),
      });

      const res = await retryQueueRoute(req);
      const json = await res.json();

      expect(res.status).toBe(202);
      expect(json.success).toBe(true);
      expect(json.postId).toBe("post-to-retry");
    });
  });
});
