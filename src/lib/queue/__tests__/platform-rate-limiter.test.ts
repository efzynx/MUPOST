import {
  PlatformRateLimiter,
  PlatformRateLimitError,
  extractRateLimitInfo,
  calculateRateLimitBackoff,
  DEFAULT_PLATFORM_RATE_LIMITS,
  DEFAULT_BACKOFF_CONFIG,
} from "../platform-rate-limiter";

describe("Platform Rate Limiter & Throttler Suite", () => {
  let limiter: PlatformRateLimiter;

  beforeEach(() => {
    limiter = new PlatformRateLimiter();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await limiter.reset();
  });

  describe("Platform Configuration Defaults", () => {
    it("should have correct default limits per platform", () => {
      expect(DEFAULT_PLATFORM_RATE_LIMITS.META_PAGE).toEqual({
        maxRequests: 50,
        windowMs: 60_000,
        minIntervalMs: 200,
      });

      expect(DEFAULT_PLATFORM_RATE_LIMITS.INSTAGRAM).toEqual({
        maxRequests: 25,
        windowMs: 60_000,
        minIntervalMs: 500,
      });

      expect(DEFAULT_PLATFORM_RATE_LIMITS.TIKTOK).toEqual({
        maxRequests: 20,
        windowMs: 60_000,
        minIntervalMs: 500,
      });

      expect(DEFAULT_PLATFORM_RATE_LIMITS.THREADS).toEqual({
        maxRequests: 30,
        windowMs: 60_000,
        minIntervalMs: 300,
      });
    });

    it("should allow dynamic configuration updates", () => {
      limiter.setConfig("INSTAGRAM", { maxRequests: 10, minIntervalMs: 1000 });
      const config = limiter.getConfig("INSTAGRAM");
      expect(config.maxRequests).toBe(10);
      expect(config.minIntervalMs).toBe(1000);
      expect(config.windowMs).toBe(60_000); // Unchanged
    });
  });

  describe("Sliding Window Rate Limiting", () => {
    it("should allow requests up to the maxRequests limit", async () => {
      limiter.setConfig("META_PAGE", { maxRequests: 3, windowMs: 10_000, minIntervalMs: 0 });

      const check1 = await limiter.checkLimit("META_PAGE");
      expect(check1.allowed).toBe(true);
      expect(check1.remaining).toBe(3);

      await limiter.consume("META_PAGE");
      const check2 = await limiter.checkLimit("META_PAGE");
      expect(check2.allowed).toBe(true);
      expect(check2.remaining).toBe(2);

      await limiter.consume("META_PAGE");
      await limiter.consume("META_PAGE");

      const check3 = await limiter.checkLimit("META_PAGE");
      expect(check3.allowed).toBe(false);
      expect(check3.remaining).toBe(0);
      expect(check3.resetMs).toBeGreaterThan(0);
    });

    it("should reject consumption and acquire when quota is exhausted", async () => {
      limiter.setConfig("TIKTOK", { maxRequests: 2, windowMs: 5000, minIntervalMs: 0 });

      await limiter.acquire("TIKTOK");
      await limiter.acquire("TIKTOK");

      const consumeRes = await limiter.consume("TIKTOK");
      expect(consumeRes.allowed).toBe(false);

      await expect(limiter.acquire("TIKTOK")).rejects.toThrow(PlatformRateLimitError);
    });
  });

  describe("Job Throttling (Spaced Interval Execution)", () => {
    it("should calculate delay when requests occur faster than minIntervalMs", async () => {
      jest.useFakeTimers();
      limiter.setConfig("THREADS", { maxRequests: 50, windowMs: 60_000, minIntervalMs: 300 });

      // First request: no previous request, waitTime = 0
      const wait1 = limiter.throttle("THREADS");
      jest.runAllTimers();
      expect(await wait1).toBe(0);

      // Second request immediately after: should wait ~300ms
      const wait2Promise = limiter.throttle("THREADS");
      jest.advanceTimersByTime(300);
      const wait2 = await wait2Promise;
      expect(wait2).toBeGreaterThanOrEqual(0);
      expect(wait2).toBeLessThanOrEqual(300);

      jest.useRealTimers();
    });
  });

  describe("Platform Lock on 429 / Rate Limit Hit", () => {
    it("should lock platform and reject acquire while lock is active", async () => {
      limiter.setConfig("INSTAGRAM", { maxRequests: 25, windowMs: 60_000, minIntervalMs: 0 });

      // Simulate receiving 429 with 30s Retry-After
      await limiter.recordRateLimitHit("INSTAGRAM", 30_000);

      const lockStatus = await limiter.isLocked("INSTAGRAM");
      expect(lockStatus.locked).toBe(true);
      expect(lockStatus.retryAfterMs).toBeGreaterThan(0);
      expect(lockStatus.retryAfterMs).toBeLessThanOrEqual(30_000);

      // checkLimit should indicate not allowed due to lock
      const limitCheck = await limiter.checkLimit("INSTAGRAM");
      expect(limitCheck.allowed).toBe(false);

      // acquire should throw PlatformRateLimitError
      await expect(limiter.acquire("INSTAGRAM")).rejects.toThrow(PlatformRateLimitError);
    });

    it("should isolate locks between different platforms", async () => {
      await limiter.recordRateLimitHit("META_PAGE", 60_000);

      const fbLock = await limiter.isLocked("META_PAGE");
      const igLock = await limiter.isLocked("INSTAGRAM");

      expect(fbLock.locked).toBe(true);
      expect(igLock.locked).toBe(false);
    });
  });

  describe("extractRateLimitInfo Helper", () => {
    it("should detect HTTP status 429", () => {
      const info = extractRateLimitInfo({ status: 429 });
      expect(info.isRateLimited).toBe(true);
      expect(info.errorCode).toBe("429");
    });

    it("should detect Retry-After header in seconds", () => {
      const headers = new Headers();
      headers.set("retry-after", "120");

      const info = extractRateLimitInfo({ status: 429, headers });
      expect(info.isRateLimited).toBe(true);
      expect(info.retryAfterMs).toBe(120_000);
    });

    it("should detect Meta Graph API rate limit error codes (4, 17, 32, 613, 80004)", () => {
      const metaCode4 = extractRateLimitInfo(
        { status: 400 },
        { error: { code: 4, message: "Application request limit reached" } }
      );
      expect(metaCode4.isRateLimited).toBe(true);
      expect(metaCode4.errorCode).toBe("4");

      const metaCode17 = extractRateLimitInfo(
        { status: 403 },
        { error: { code: 17, message: "User request limit reached" } }
      );
      expect(metaCode17.isRateLimited).toBe(true);
      expect(metaCode17.errorCode).toBe("17");

      const metaCode32 = extractRateLimitInfo(
        { status: 403 },
        { error: { code: 32, message: "Page request limit reached" } }
      );
      expect(metaCode32.isRateLimited).toBe(true);

      const metaCode613 = extractRateLimitInfo(
        { status: 400 },
        { error: { code: 613, message: "Calls to this api have exceeded the rate limit" } }
      );
      expect(metaCode613.isRateLimited).toBe(true);

      const metaCode80004 = extractRateLimitInfo(
        { status: 400 },
        { error: { code: 80004, message: "There have been too many calls to this account" } }
      );
      expect(metaCode80004.isRateLimited).toBe(true);
    });

    it("should detect TikTok rate limit error codes and messages", () => {
      const tiktok1 = extractRateLimitInfo(
        { status: 400 },
        { error: { code: "rate_limit_exceeded", message: "Rate limit exceeded" } }
      );
      expect(tiktok1.isRateLimited).toBe(true);

      const tiktok2 = extractRateLimitInfo(
        { status: 400 },
        { error: { code: "spam_risk_too_many_pending_share", message: "Too many pending shares" } }
      );
      expect(tiktok2.isRateLimited).toBe(true);
    });

    it("should return isRateLimited: false for regular non-rate-limit errors", () => {
      const authErr = extractRateLimitInfo(
        { status: 401 },
        { error: { code: 190, message: "Session expired" } }
      );
      expect(authErr.isRateLimited).toBe(false);

      const notFoundErr = extractRateLimitInfo(
        { status: 404 },
        { error: { code: 803, message: "Some of the aliases you requested do not exist" } }
      );
      expect(notFoundErr.isRateLimited).toBe(false);
    });
  });

  describe("calculateRateLimitBackoff", () => {
    it("should calculate standard exponential backoff: 1 min, 2 min, 4 min", () => {
      const baseDelay = DEFAULT_BACKOFF_CONFIG.baseDelayMs; // 60_000 ms

      // Attempt 1 -> 2^0 * 60s = 60s (1 menit)
      expect(calculateRateLimitBackoff(1, undefined, baseDelay)).toBe(60_000);

      // Attempt 2 -> 2^1 * 60s = 120s (2 menit)
      expect(calculateRateLimitBackoff(2, undefined, baseDelay)).toBe(120_000);

      // Attempt 3 -> 2^2 * 60s = 240s (4 menit)
      expect(calculateRateLimitBackoff(3, undefined, baseDelay)).toBe(240_000);
    });

    it("should prioritize larger retryAfterMs from rate limit header over exponential delay", () => {
      const err = new PlatformRateLimitError("Rate limit", "INSTAGRAM", 180_000); // 3 menit

      // Attempt 1 would normally be 60s, but retryAfter is 180s -> should return 180s
      expect(calculateRateLimitBackoff(1, err, 60_000)).toBe(180_000);

      // If exponential is larger than retryAfter, exponential wins
      const smallErr = new PlatformRateLimitError("Rate limit", "THREADS", 30_000); // 30s
      // Attempt 2 exponential is 120s > 30s -> should return 120s
      expect(calculateRateLimitBackoff(2, smallErr, 60_000)).toBe(120_000);
    });

    it("should respect maxDelayMs cap", () => {
      // Attempt 10 would be huge, should cap at 300_000 ms (5 menit)
      expect(calculateRateLimitBackoff(10, undefined, 60_000)).toBe(
        DEFAULT_BACKOFF_CONFIG.maxDelayMs
      );
    });
  });
});
