import {
  publishToMeta,
  publishToInstagram,
  publishToTikTok,
  publishToThreads,
  processPublishJob,
  createPublishWorker,
} from "../publish-worker";
import { platformRateLimiter, PlatformRateLimitError } from "@/lib/queue/platform-rate-limiter";
import { createPublishQueue } from "@/lib/queue/publish-queue";
import { db } from "@/lib/db";
import * as cryptoModule from "@/lib/crypto";

// Mock db
jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
  },
}));

// Mock post-events
jest.mock("@/lib/services/post-events", () => ({
  publishPostEvent: jest.fn().mockResolvedValue(undefined),
}));

describe("Publish Worker: Platform Rate Limiting & Throttling", () => {
  const originalFetch = global.fetch;
  const mockTargetId = "target-rate-limit-1";
  const mockAccount = { platformAccountId: "platform-acc-123" };
  const mockAccessToken = "mock-token-xyz";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await platformRateLimiter.reset();
  });

  describe("Platform API Rate Limit Response Handling", () => {
    it("publishToMeta should return isRateLimited: true and retryAfterMs on 429", async () => {
      const headers = new Headers();
      headers.set("retry-after", "60");

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers,
        json: async () => ({
          error: {
            code: 4,
            message: "Application request limit reached",
          },
        }),
      } as unknown as Response);

      const result = await publishToMeta(
        mockTargetId,
        { textContent: "Meta post" },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(false);
      expect(result.isRateLimited).toBe(true);
      expect(result.errorCode).toBe("4");
      expect(result.retryAfterMs).toBe(60_000);
    });

    it("publishToInstagram should return isRateLimited: true on container 429", async () => {
      const headers = new Headers();
      headers.set("retry-after", "90");

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers,
        json: async () => ({
          error: {
            code: 17,
            message: "User request limit reached",
          },
        }),
      } as unknown as Response);

      const result = await publishToInstagram(
        mockTargetId,
        { textContent: "IG post", mediaUrls: ["https://example.com/img.jpg"] },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(false);
      expect(result.isRateLimited).toBe(true);
      expect(result.errorCode).toBe("17");
      expect(result.retryAfterMs).toBe(90_000);
    });

    it("publishToTikTok should return isRateLimited: true on rate_limit_exceeded", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: "rate_limit_exceeded",
            message: "Direct Post API rate limit reached",
          },
        }),
      } as unknown as Response);

      const result = await publishToTikTok(
        mockTargetId,
        { textContent: "TikTok video", mediaUrls: ["https://example.com/video.mp4"] },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(false);
      expect(result.isRateLimited).toBe(true);
      expect(result.errorCode).toBe("rate_limit_exceeded");
    });

    it("publishToThreads should return isRateLimited: true on Threads 429", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            code: 613,
            message: "Calls to this api have exceeded the rate limit",
          },
        }),
      } as unknown as Response);

      const result = await publishToThreads(
        mockTargetId,
        { textContent: "Threads text" },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(false);
      expect(result.isRateLimited).toBe(true);
      expect(result.errorCode).toBe("613");
    });
  });

  describe("processPublishJob with Proactive Limiting & Reactive 429 Backoff", () => {
    const mockPostId = "post-test-rate-limit";
    const mockUserId = "user-123";

    it("should lock platform and fail target with isRateLimited when 429 is encountered", async () => {
      const mockPost = {
        id: mockPostId,
        userId: mockUserId,
        status: "QUEUED",
        textContent: "Hello World",
        mediaUrls: [],
        publishedAt: null,
      };

      const mockTarget = {
        id: "target-meta-1",
        postId: mockPostId,
        connectedAccountId: "acc-1",
        platform: "META_PAGE",
        status: "PENDING",
        retryCount: 0,
      };

      const mockAccountData = {
        id: "acc-1",
        userId: mockUserId,
        platform: "META_PAGE",
        platformAccountId: "fb-page-1",
        accessTokenEnc: "enc-token",
        status: "ACTIVE",
      };

      let selectCallCount = 0;
      (db.select as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return { limit: jest.fn().mockResolvedValue([mockPost]) };
            } else if (selectCallCount === 2) {
              return Promise.resolve([mockTarget]);
            } else {
              return Promise.resolve([mockAccountData]);
            }
          }),
        })),
      }));

      const updateSetMock = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue({}),
      });
      (db.update as jest.Mock).mockReturnValue({ set: updateSetMock });

      jest.spyOn(cryptoModule, "decrypt").mockReturnValue("decrypted-token");

      // Mock 429 on Meta
      const headers = new Headers();
      headers.set("retry-after", "60");
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers,
        json: async () => ({
          error: { code: 4, message: "Application request limit reached" },
        }),
      } as unknown as Response);

      const result = await processPublishJob({
        data: { postId: mockPostId },
      });

      expect(result.postStatus).toBe("FAILED");
      expect(result.results[0]?.isRateLimited).toBe(true);
      expect(result.results[0]?.errorCode).toBe("4");
      expect(result.results[0]?.retryAfterMs).toBe(60_000);

      // Verify platform rate limiter recorded the lock
      const lockCheck = await platformRateLimiter.isLocked("META_PAGE", "fb-page-1");
      expect(lockCheck.locked).toBe(true);

      // Target update should have FAILED with errorCode
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "FAILED",
          errorCode: "4",
        })
      );
    });

    it("should throw PlatformRateLimitError when throwOnRateLimit is true so BullMQ triggers retry", async () => {
      const mockPost = {
        id: mockPostId,
        userId: mockUserId,
        status: "QUEUED",
        textContent: "Hello World",
        mediaUrls: ["https://example.com/photo.jpg"],
        publishedAt: null,
      };

      const mockTarget = {
        id: "target-ig-1",
        postId: mockPostId,
        connectedAccountId: "acc-ig",
        platform: "INSTAGRAM",
        status: "PENDING",
        retryCount: 0,
      };

      const mockAccountData = {
        id: "acc-ig",
        userId: mockUserId,
        platform: "INSTAGRAM",
        platformAccountId: "ig-acc-1",
        accessTokenEnc: "enc-token",
        status: "ACTIVE",
      };

      let selectCallCount = 0;
      (db.select as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return { limit: jest.fn().mockResolvedValue([mockPost]) };
            } else if (selectCallCount === 2) {
              return Promise.resolve([mockTarget]);
            } else {
              return Promise.resolve([mockAccountData]);
            }
          }),
        })),
      }));

      (db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue({}) }),
      });

      jest.spyOn(cryptoModule, "decrypt").mockReturnValue("decrypted-token");

      // Mock Instagram 429
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { code: 4, message: "Rate limit reached" },
        }),
      } as unknown as Response);

      await expect(
        processPublishJob({ data: { postId: mockPostId } }, { throwOnRateLimit: true })
      ).rejects.toThrow(PlatformRateLimitError);
    });

    it("should skip already PUBLISHED targets and only retry FAILED/rate-limited targets on subsequent attempt", async () => {
      const targetFacebook = {
        id: "t-fb",
        postId: mockPostId,
        connectedAccountId: "acc-fb",
        platform: "META_PAGE",
        status: "PUBLISHED", // Succeeded on attempt 1!
        retryCount: 0,
      };

      const targetInstagram = {
        id: "t-ig",
        postId: mockPostId,
        connectedAccountId: "acc-ig",
        platform: "INSTAGRAM",
        status: "FAILED", // Failed on attempt 1 due to rate limit!
        retryCount: 1,
      };

      const mockPost = {
        id: mockPostId,
        userId: mockUserId,
        status: "PARTIAL",
        textContent: "Cross-platform post",
        mediaUrls: ["https://example.com/photo.jpg"],
        publishedAt: null,
      };

      const mockAccountIG = {
        id: "acc-ig",
        userId: mockUserId,
        platform: "INSTAGRAM",
        platformAccountId: "ig-acc-1",
        accessTokenEnc: "enc-token",
        status: "ACTIVE",
      };

      let selectCallCount = 0;
      (db.select as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return { limit: jest.fn().mockResolvedValue([mockPost]) };
            } else if (selectCallCount === 2) {
              // Both targets in post
              return Promise.resolve([targetFacebook, targetInstagram]);
            } else {
              // Only IG account requested because FB is already PUBLISHED
              return Promise.resolve([mockAccountIG]);
            }
          }),
        })),
      }));

      const updateSetMock = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue({}),
      });
      (db.update as jest.Mock).mockReturnValue({ set: updateSetMock });

      jest.spyOn(cryptoModule, "decrypt").mockReturnValue("decrypted-token");

      // Instagram container creation and publish succeed on retry attempt!
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "ig-container-123" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "ig-published-post-789" }),
        } as unknown as Response);

      const result = await processPublishJob({ data: { postId: mockPostId } });

      // Aggregate status should now be fully PUBLISHED!
      expect(result.postStatus).toBe("PUBLISHED");
      expect(result.results.length).toBe(1); // Only IG was executed
      expect(result.results[0]?.targetId).toBe("t-ig");
      expect(result.results[0]?.success).toBe(true);

      // Verify post final update was PUBLISHED
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "PUBLISHED",
        })
      );
    });

    it("should block proactive execution when platform is locked due to earlier 429", async () => {
      // Manually lock Threads
      await platformRateLimiter.recordRateLimitHit("THREADS", 60_000, "threads-acc-1");

      const mockPost = {
        id: mockPostId,
        userId: mockUserId,
        status: "QUEUED",
        textContent: "Hello Threads",
        mediaUrls: [],
        publishedAt: null,
      };

      const mockTarget = {
        id: "target-th-1",
        postId: mockPostId,
        connectedAccountId: "acc-th",
        platform: "THREADS",
        status: "PENDING",
        retryCount: 0,
      };

      const mockAccountData = {
        id: "acc-th",
        userId: mockUserId,
        platform: "THREADS",
        platformAccountId: "threads-acc-1",
        accessTokenEnc: "enc-token",
        status: "ACTIVE",
      };

      let selectCallCount = 0;
      (db.select as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return { limit: jest.fn().mockResolvedValue([mockPost]) };
            } else if (selectCallCount === 2) {
              return Promise.resolve([mockTarget]);
            } else {
              return Promise.resolve([mockAccountData]);
            }
          }),
        })),
      }));

      (db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue({}) }),
      });
      jest.spyOn(cryptoModule, "decrypt").mockReturnValue("decrypted-token");

      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;

      const result = await processPublishJob({ data: { postId: mockPostId } });

      // Target should be failed with RATE_LIMIT_EXCEEDED without ever calling fetch!
      expect(result.results[0]?.success).toBe(false);
      expect(result.results[0]?.isRateLimited).toBe(true);
      expect(result.results[0]?.errorCode).toBe("RATE_LIMIT_EXCEEDED");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("BullMQ Queue & Worker Rate Limiting Configuration", () => {
    it("createPublishQueue should configure default exponential backoff and accept custom options", async () => {
      const mockRedisClient = { status: "ready" } as any;
      const queue = createPublishQueue({
        connection: mockRedisClient,
        defaultJobOptions: {
          attempts: 5,
        },
      });

      expect(queue).toBeDefined();
      expect(queue.name).toBe("publish-queue");
      expect(queue.opts.defaultJobOptions?.attempts).toBe(5);
      expect(queue.opts.defaultJobOptions?.backoff).toEqual({
        type: "exponential",
        delay: 60_000,
      });

      await queue.close();
    });

    it("createPublishWorker should configure limiter and custom backoff strategy", async () => {
      const mockRedisClient = { status: "ready" } as any;
      const worker = createPublishWorker({
        connection: mockRedisClient,
        concurrency: 3,
        limiter: { max: 10, duration: 2000 },
        autorun: false,
      });

      expect(worker).toBeDefined();
      expect(worker.opts.concurrency).toBe(3);
      expect(worker.opts.limiter).toEqual({
        max: 10,
        duration: 2000,
      });
      expect(typeof worker.opts.settings?.backoffStrategy).toBe("function");

      // Verify backoff calculation through worker's strategy
      const strategy = worker.opts.settings?.backoffStrategy;
      if (strategy) {
        expect(strategy(1, "custom", new Error())).toBe(60_000);
        expect(strategy(2, "custom", new Error())).toBe(120_000);
        expect(strategy(3, "custom", new Error())).toBe(240_000);
      }

      await worker.close();
    });
  });
});
