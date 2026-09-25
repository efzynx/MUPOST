import { processPublishJob } from "../publish-worker";
import {
  PlatformRateLimiter,
  extractRateLimitInfo,
  calculateRateLimitBackoff,
  DEFAULT_PLATFORM_RATE_LIMITS,
  DEFAULT_BACKOFF_CONFIG,
  platformRateLimiter,
} from "@/lib/queue/platform-rate-limiter";
import { db } from "@/lib/db";
import * as cryptoModule from "@/lib/crypto";
import type Redis from "ioredis";

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

describe("QC Kia QA Suite: Comprehensive Rate Limiting & Edge Cases", () => {
  const originalFetch = global.fetch;
  const mockPostId = "qa-post-rate-limit-1";
  const mockUserId = "qa-user-1";

  afterEach(async () => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
    await platformRateLimiter.reset();
  });

  // =========================================================================
  // 1. Sliding Window Limiter: Redis Operations & In-Memory Fallback
  // =========================================================================
  describe("1. Sliding Window Limiter: Redis Operations & In-Memory Fallback", () => {
    let mockRedis: jest.Mocked<Partial<Redis>>;

    beforeEach(() => {
      mockRedis = {
        get: jest.fn(),
        set: jest.fn(),
        zremrangebyscore: jest.fn(),
        zcard: jest.fn(),
        zadd: jest.fn(),
        pexpire: jest.fn(),
      } as unknown as jest.Mocked<Partial<Redis>>;
    });

    it("should use Redis for isLocked check when Redis is available", async () => {
      const futureExpiry = Date.now() + 45_000;
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(futureExpiry.toString());

      const limiter = new PlatformRateLimiter(mockRedis as unknown as Redis);
      const lockStatus = await limiter.isLocked("META_PAGE", "acc-fb-1");

      expect(mockRedis.get).toHaveBeenCalledWith("rate_limit:locked:META_PAGE:acc-fb-1");
      expect(lockStatus.locked).toBe(true);
      expect(lockStatus.retryAfterMs).toBeGreaterThan(0);
      expect(lockStatus.retryAfterMs).toBeLessThanOrEqual(45_000);
    });

    it("should set Redis key with PX when recordRateLimitHit is called", async () => {
      (mockRedis.set as jest.Mock).mockResolvedValueOnce("OK");

      const limiter = new PlatformRateLimiter(mockRedis as unknown as Redis);
      await limiter.recordRateLimitHit("INSTAGRAM", 50_000, "acc-ig-1");

      expect(mockRedis.set).toHaveBeenCalledWith(
        "rate_limit:locked:INSTAGRAM:acc-ig-1",
        expect.any(String),
        "PX",
        50_000
      );
    });

    it("should query Redis zremrangebyscore and zcard during checkLimit", async () => {
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(null); // not locked
      (mockRedis.zremrangebyscore as jest.Mock).mockResolvedValueOnce(1);
      (mockRedis.zcard as jest.Mock).mockResolvedValueOnce(10);

      const limiter = new PlatformRateLimiter(mockRedis as unknown as Redis);
      const res = await limiter.checkLimit("META_PAGE", "acc-fb-1");

      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
      expect(mockRedis.zcard).toHaveBeenCalledWith("rate_limit:window:META_PAGE:acc-fb-1");
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(40); // 50 - 10
    });

    it("should block request when Redis zcard reaches maxRequests", async () => {
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(null); // not locked
      (mockRedis.zremrangebyscore as jest.Mock).mockResolvedValueOnce(0);
      (mockRedis.zcard as jest.Mock).mockResolvedValueOnce(50); // limit reached

      const limiter = new PlatformRateLimiter(mockRedis as unknown as Redis);
      const res = await limiter.checkLimit("META_PAGE", "acc-fb-1");

      expect(res.allowed).toBe(false);
      expect(res.remaining).toBe(0);
      expect(res.resetMs).toBe(60_000);
    });

    it("should call Redis zadd and pexpire on consume", async () => {
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(null);
      (mockRedis.zremrangebyscore as jest.Mock).mockResolvedValueOnce(0);
      (mockRedis.zcard as jest.Mock).mockResolvedValueOnce(5);
      (mockRedis.zadd as jest.Mock).mockResolvedValueOnce(1);
      (mockRedis.pexpire as jest.Mock).mockResolvedValueOnce(1);

      const limiter = new PlatformRateLimiter(mockRedis as unknown as Redis);
      const res = await limiter.consume("META_PAGE", "acc-fb-1");

      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(44); // 50 - 5 - 1
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.pexpire).toHaveBeenCalledWith(
        "rate_limit:window:META_PAGE:acc-fb-1",
        60_000
      );
    });

    it("should gracefully fall back to in-memory when Redis throws an error on checkLimit and consume", async () => {
      (mockRedis.get as jest.Mock).mockRejectedValue(new Error("Redis connection dropped"));
      (mockRedis.zremrangebyscore as jest.Mock).mockRejectedValue(
        new Error("Redis connection dropped")
      );
      (mockRedis.zcard as jest.Mock).mockRejectedValue(new Error("Redis connection dropped"));
      (mockRedis.zadd as jest.Mock).mockRejectedValue(new Error("Redis connection dropped"));
      (mockRedis.pexpire as jest.Mock).mockRejectedValue(new Error("Redis connection dropped"));

      const limiter = new PlatformRateLimiter(mockRedis as unknown as Redis);
      limiter.setConfig("THREADS", { maxRequests: 2, windowMs: 10_000, minIntervalMs: 0 });

      // First consume: Redis errors caught, falls back to memory, returns allowed
      const c1 = await limiter.consume("THREADS", "acc-th-1");
      expect(c1.allowed).toBe(true);
      expect(c1.remaining).toBe(1);

      // Second consume: falls back to memory, allowed
      const c2 = await limiter.consume("THREADS", "acc-th-1");
      expect(c2.allowed).toBe(true);
      expect(c2.remaining).toBe(0);

      // Third consume: in-memory limit reached, rejects
      const c3 = await limiter.consume("THREADS", "acc-th-1");
      expect(c3.allowed).toBe(false);
      expect(c3.remaining).toBe(0);
    });

    it("should prune expired timestamps in in-memory sliding window", async () => {
      const limiter = new PlatformRateLimiter();
      limiter.setConfig("TIKTOK", { maxRequests: 2, windowMs: 1000, minIntervalMs: 0 });

      // Consume 2 requests at t=0
      await limiter.consume("TIKTOK");
      await limiter.consume("TIKTOK");

      const checkFull = await limiter.checkLimit("TIKTOK");
      expect(checkFull.allowed).toBe(false);

      // Wait for window to slide past 1000ms
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const checkFreed = await limiter.checkLimit("TIKTOK");
      expect(checkFreed.allowed).toBe(true);
      expect(checkFreed.remaining).toBe(2);
    });

    it("should isolate rate limits across different accountIds for the same platform", async () => {
      const limiter = new PlatformRateLimiter();
      limiter.setConfig("META_PAGE", { maxRequests: 1, windowMs: 10_000, minIntervalMs: 0 });

      // Consume quota for Account A
      await limiter.consume("META_PAGE", "page-A");
      const checkA = await limiter.checkLimit("META_PAGE", "page-A");
      expect(checkA.allowed).toBe(false);

      // Account B should still have full quota
      const checkB = await limiter.checkLimit("META_PAGE", "page-B");
      expect(checkB.allowed).toBe(true);
      expect(checkB.remaining).toBe(1);
    });

    it("should use Redis for throttle when Redis is available", async () => {
      const prevTs = Date.now() - 20;
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(prevTs.toString());
      (mockRedis.set as jest.Mock).mockResolvedValueOnce("OK");

      const limiter = new PlatformRateLimiter(mockRedis as unknown as Redis);
      limiter.setConfig("THREADS", { minIntervalMs: 50 });

      const wait = await limiter.throttle("THREADS", "acc-th-1");
      expect(wait).toBeGreaterThan(0);
      expect(mockRedis.get).toHaveBeenCalledWith("throttle:platform:THREADS:acc-th-1");
      expect(mockRedis.set).toHaveBeenCalledWith(
        "throttle:platform:THREADS:acc-th-1",
        expect.any(String),
        "PX",
        500
      );
    });

    it("should reset only the specified platform when reset(platform) is called", async () => {
      const limiter = new PlatformRateLimiter();
      limiter.setConfig("META_PAGE", { maxRequests: 1, windowMs: 10_000, minIntervalMs: 100 });
      limiter.setConfig("INSTAGRAM", { maxRequests: 1, windowMs: 10_000, minIntervalMs: 100 });

      await limiter.consume("META_PAGE");
      await limiter.consume("INSTAGRAM");
      await limiter.recordRateLimitHit("META_PAGE", 10_000);
      await limiter.recordRateLimitHit("INSTAGRAM", 10_000);
      await limiter.throttle("META_PAGE");
      await limiter.throttle("INSTAGRAM");

      expect((await limiter.checkLimit("META_PAGE")).allowed).toBe(false);
      expect((await limiter.checkLimit("INSTAGRAM")).allowed).toBe(false);
      expect((await limiter.isLocked("META_PAGE")).locked).toBe(true);
      expect((await limiter.isLocked("INSTAGRAM")).locked).toBe(true);

      // Reset only META_PAGE
      await limiter.reset("META_PAGE");

      expect((await limiter.checkLimit("META_PAGE")).allowed).toBe(true);
      expect((await limiter.checkLimit("INSTAGRAM")).allowed).toBe(false);
      expect((await limiter.isLocked("META_PAGE")).locked).toBe(false);
      expect((await limiter.isLocked("INSTAGRAM")).locked).toBe(true);
    });
  });

  // =========================================================================
  // 2. Platform Throttling Verification
  // =========================================================================
  describe("2. Platform Throttling Verification", () => {
    it("should correctly report configured minIntervalMs for all 4 platforms", () => {
      expect(DEFAULT_PLATFORM_RATE_LIMITS.META_PAGE.minIntervalMs).toBe(200);
      expect(DEFAULT_PLATFORM_RATE_LIMITS.INSTAGRAM.minIntervalMs).toBe(500);
      expect(DEFAULT_PLATFORM_RATE_LIMITS.TIKTOK.minIntervalMs).toBe(500);
      expect(DEFAULT_PLATFORM_RATE_LIMITS.THREADS.minIntervalMs).toBe(300);
    });

    it("should return 0 immediately if minIntervalMs <= 0", async () => {
      const limiter = new PlatformRateLimiter();
      limiter.setConfig("META_PAGE", { minIntervalMs: 0 });

      const wait = await limiter.throttle("META_PAGE");
      expect(wait).toBe(0);
    });

    it("should isolate throttling between different platforms", async () => {
      jest.useFakeTimers();
      const limiter = new PlatformRateLimiter();

      // Trigger throttle for META_PAGE
      const waitFB = limiter.throttle("META_PAGE");
      jest.runAllTimers();
      expect(await waitFB).toBe(0);

      // Immediately call throttle for INSTAGRAM — should be independent (0 wait)
      const waitIG = limiter.throttle("INSTAGRAM");
      jest.runAllTimers();
      expect(await waitIG).toBe(0);

      jest.useRealTimers();
    });

    it("should isolate throttling between different account IDs on the same platform", async () => {
      jest.useFakeTimers();
      const limiter = new PlatformRateLimiter();

      const waitAcc1 = limiter.throttle("META_PAGE", "page-1");
      jest.runAllTimers();
      expect(await waitAcc1).toBe(0);

      const waitAcc2 = limiter.throttle("META_PAGE", "page-2");
      jest.runAllTimers();
      expect(await waitAcc2).toBe(0);

      jest.useRealTimers();
    });
  });

  // =========================================================================
  // 3. Upstream 429 & Custom Exponential Backoff Verification
  // =========================================================================
  describe("3. Upstream 429 & Custom Exponential Backoff Verification", () => {
    it("should detect rate limit from Meta Graph API subcode 2446079", () => {
      const info = extractRateLimitInfo(
        { status: 400 },
        { error: { message: "Some rate limit", error_subcode: 2446079 } }
      );
      expect(info.isRateLimited).toBe(true);
    });

    it("should detect rate limit from error messages containing quota/limit keywords", () => {
      const msg1 = extractRateLimitInfo(
        { status: 400 },
        { error: { message: "Daily quota exceeded for this endpoint" } }
      );
      expect(msg1.isRateLimited).toBe(true);

      const msg2 = extractRateLimitInfo(
        { status: 400 },
        { error: { message: "Too many requests sent in a short period" } }
      );
      expect(msg2.isRateLimited).toBe(true);

      const msg3 = extractRateLimitInfo(
        { status: 400 },
        { error: { message: "Request limit reached for today" } }
      );
      expect(msg3.isRateLimited).toBe(true);
    });

    it("should handle null or malformed response gracefully in extractRateLimitInfo", () => {
      const nullRes = extractRateLimitInfo(null, null);
      expect(nullRes.isRateLimited).toBe(false);
      expect(nullRes.errorCode).toBeUndefined();

      const emptyRes = extractRateLimitInfo({}, {});
      expect(emptyRes.isRateLimited).toBe(false);
    });

    it("should handle non-numeric or malformed Retry-After headers gracefully", () => {
      const headers = new Headers();
      headers.set("retry-after", "invalid-seconds");

      const info = extractRateLimitInfo({ status: 429, headers });
      expect(info.isRateLimited).toBe(true);
      expect(info.retryAfterMs).toBeUndefined();
    });

    it("should correctly compute exponential backoff with zero or negative attemptsMade", () => {
      // attemptsMade <= 1 should yield baseDelay (60s)
      expect(calculateRateLimitBackoff(0)).toBe(60_000);
      expect(calculateRateLimitBackoff(-1)).toBe(60_000);
      expect(calculateRateLimitBackoff(1)).toBe(60_000);
      expect(calculateRateLimitBackoff(2)).toBe(120_000);
      expect(calculateRateLimitBackoff(3)).toBe(240_000);
    });

    it("should cap backoff at maxDelayMs (300_000 ms) for large attemptsMade", () => {
      expect(calculateRateLimitBackoff(5)).toBe(DEFAULT_BACKOFF_CONFIG.maxDelayMs);
      expect(calculateRateLimitBackoff(10)).toBe(DEFAULT_BACKOFF_CONFIG.maxDelayMs);
    });
  });

  // =========================================================================
  // 4. Retry Mechanics: Skip Already-PUBLISHED Targets
  // =========================================================================
  describe("4. Retry Mechanics: Skip Already-PUBLISHED Targets", () => {
    it("should return immediately with PUBLISHED if all targets are already PUBLISHED", async () => {
      const mockPost = {
        id: mockPostId,
        userId: mockUserId,
        status: "PUBLISHED",
        textContent: "All done post",
        mediaUrls: [],
        publishedAt: new Date(),
      };

      const mockTarget1 = {
        id: "t-1",
        postId: mockPostId,
        connectedAccountId: "acc-1",
        platform: "META_PAGE",
        status: "PUBLISHED",
        retryCount: 0,
      };

      const mockTarget2 = {
        id: "t-2",
        postId: mockPostId,
        connectedAccountId: "acc-2",
        platform: "INSTAGRAM",
        status: "PUBLISHED",
        retryCount: 0,
      };

      let selectCallCount = 0;
      (db.select as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return { limit: jest.fn().mockResolvedValue([mockPost]) };
            } else {
              return Promise.resolve([mockTarget1, mockTarget2]);
            }
          }),
        })),
      }));

      const updateSpy = jest.fn();
      (db.update as jest.Mock).mockImplementation(updateSpy);

      const result = await processPublishJob({ data: { postId: mockPostId } });

      expect(result.postStatus).toBe("PUBLISHED");
      expect(result.results).toHaveLength(0);
      // DB update should NOT be called to set PUBLISHING
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("should only execute FAILED targets in a 4-platform post when 2 are already PUBLISHED", async () => {
      const targetFB = {
        id: "t-fb",
        postId: mockPostId,
        connectedAccountId: "acc-fb",
        platform: "META_PAGE",
        status: "PUBLISHED", // already published!
        retryCount: 0,
      };

      const targetIG = {
        id: "t-ig",
        postId: mockPostId,
        connectedAccountId: "acc-ig",
        platform: "INSTAGRAM",
        status: "PUBLISHED", // already published!
        retryCount: 0,
      };

      const targetTikTok = {
        id: "t-tt",
        postId: mockPostId,
        connectedAccountId: "acc-tt",
        platform: "TIKTOK",
        status: "FAILED", // retry this!
        retryCount: 1,
      };

      const targetThreads = {
        id: "t-th",
        postId: mockPostId,
        connectedAccountId: "acc-th",
        platform: "THREADS",
        status: "FAILED", // retry this!
        retryCount: 1,
      };

      const mockPost = {
        id: mockPostId,
        userId: mockUserId,
        status: "PARTIAL",
        textContent: "Omnichannel post",
        mediaUrls: ["https://example.com/photo.jpg"],
        publishedAt: null,
      };

      const mockAccTT = {
        id: "acc-tt",
        userId: mockUserId,
        platform: "TIKTOK",
        platformAccountId: "tt-acc-1",
        accessTokenEnc: "enc-tt",
        status: "ACTIVE",
      };

      const mockAccTH = {
        id: "acc-th",
        userId: mockUserId,
        platform: "THREADS",
        platformAccountId: "th-acc-1",
        accessTokenEnc: "enc-th",
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
              return Promise.resolve([targetFB, targetIG, targetTikTok, targetThreads]);
            } else {
              return Promise.resolve([mockAccTT, mockAccTH]);
            }
          }),
        })),
      }));

      const updateSetMock = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue({}),
      });
      (db.update as jest.Mock).mockReturnValue({ set: updateSetMock });

      jest.spyOn(cryptoModule, "decrypt").mockReturnValue("decrypted-token");

      // Mock TikTok success & Threads success
      global.fetch = jest
        .fn()
        // TikTok publish success
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { publish_id: "tiktok-pub-123" } }),
        } as unknown as Response)
        // Threads container creation success
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "th-container-123" }),
        } as unknown as Response)
        // Threads container publish success
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "th-post-456" }),
        } as unknown as Response);

      const result = await processPublishJob({ data: { postId: mockPostId } });

      // Results should only contain the 2 retried targets
      expect(result.results).toHaveLength(2);
      expect(result.results.map((r) => r.targetId)).toEqual(["t-tt", "t-th"]);
      expect(result.results[0]?.success).toBe(true);
      expect(result.results[1]?.success).toBe(true);

      // Final post status should become PUBLISHED because all 4 targets are now PUBLISHED
      expect(result.postStatus).toBe("PUBLISHED");

      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "PUBLISHED",
        })
      );
    });

    it("should target only retryTargetId when specified in job data", async () => {
      const target1 = {
        id: "t-target-1",
        postId: mockPostId,
        connectedAccountId: "acc-1",
        platform: "META_PAGE",
        status: "FAILED",
        retryCount: 1,
      };

      const target2 = {
        id: "t-target-2",
        postId: mockPostId,
        connectedAccountId: "acc-2",
        platform: "THREADS",
        status: "FAILED",
        retryCount: 1,
      };

      const mockPost = {
        id: mockPostId,
        userId: mockUserId,
        status: "FAILED",
        textContent: "Single target retry",
        mediaUrls: [],
        publishedAt: null,
      };

      const mockAcc2 = {
        id: "acc-2",
        userId: mockUserId,
        platform: "THREADS",
        platformAccountId: "th-acc-2",
        accessTokenEnc: "enc-th-2",
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
              return Promise.resolve([target1, target2]);
            } else {
              return Promise.resolve([mockAcc2]);
            }
          }),
        })),
      }));

      (db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue({}) }),
      });

      jest.spyOn(cryptoModule, "decrypt").mockReturnValue("decrypted-token");

      // Threads publish mock
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "th-container-retry" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "th-publish-retry" }),
        } as unknown as Response);

      const result = await processPublishJob({
        data: { postId: mockPostId, retryTargetId: "t-target-2" },
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.targetId).toBe("t-target-2");
      expect(result.results[0]?.success).toBe(true);
    });
  });
});
