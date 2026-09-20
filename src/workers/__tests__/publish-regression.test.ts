import { publishToMeta, publishToThreads, publishToTikTok } from "../publish-worker";

describe("Regression Tests: Other Platforms Publishing", () => {
  const originalFetch = global.fetch;
  const mockTargetId = "target-123";
  const mockAccount = { platformAccountId: "account-456" };
  const mockAccessToken = "mock-access-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("publishToMeta (Facebook Page)", () => {
    it("should publish text-only post to Facebook feed", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "fb-feed-123" }),
      } as unknown as Response);

      const result = await publishToMeta(
        mockTargetId,
        { textContent: "Hello Facebook", mediaUrls: [] },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(true);
      expect(result.platform).toBe("META_PAGE");
      expect(result.platformPostId).toBe("fb-feed-123");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockAccount.platformAccountId}/feed`),
        expect.anything()
      );
    });

    it("should publish photo post to Facebook photos endpoint", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "fb-photo-123", post_id: "fb-post-456" }),
      } as unknown as Response);

      const result = await publishToMeta(
        mockTargetId,
        { textContent: "Check out this photo", mediaUrls: ["https://example.com/pic.jpg"] },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe("fb-photo-123");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockAccount.platformAccountId}/photos`),
        expect.anything()
      );
    });

    it("should publish video post to Facebook videos endpoint", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "fb-video-123" }),
      } as unknown as Response);

      const result = await publishToMeta(
        mockTargetId,
        { textContent: "Check out this video", mediaUrls: ["https://example.com/video.mp4"] },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe("fb-video-123");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockAccount.platformAccountId}/videos`),
        expect.anything()
      );
    });

    it("should flag needsReauth when Facebook token is expired (code 190)", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 190,
            type: "OAuthException",
            message: "Error validating access token: Session has expired",
          },
        }),
      } as unknown as Response);

      const result = await publishToMeta(
        mockTargetId,
        { textContent: "Test post" },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(false);
      expect(result.needsReauth).toBe(true);
      expect(result.errorCode).toBe("190");
    });
  });

  describe("publishToThreads", () => {
    it("should publish text post to Threads via 2-step flow", async () => {
      const fetchMock = jest.fn();
      // Step 1: container creation
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "threads-container-123" }),
      });
      // Step 2: threads_publish
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "threads-pub-456" }),
      });

      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await publishToThreads(
        mockTargetId,
        { textContent: "Hello Threads!", mediaUrls: [] },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(true);
      expect(result.platform).toBe("THREADS");
      expect(result.platformPostId).toBe("threads-pub-456");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should publish photo post to Threads", async () => {
      const fetchMock = jest.fn();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "threads-img-container" }),
      });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "threads-img-published" }),
      });

      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await publishToThreads(
        mockTargetId,
        { textContent: "Threads photo", mediaUrls: ["https://example.com/pic.jpg"] },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe("threads-img-published");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should publish video post to Threads", async () => {
      const fetchMock = jest.fn();
      // 1. Container creation
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "threads-vid-container" }),
      });
      // 2. Status polling -> FINISHED
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: "FINISHED" }),
      });
      // 3. Publish container
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "threads-vid-published" }),
      });

      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await publishToThreads(
        mockTargetId,
        { textContent: "Threads video", mediaUrls: ["https://example.com/vid.mp4"] },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe("threads-vid-published");
      expect(fetchMock).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  describe("publishToTikTok", () => {
    it("should return MISSING_MEDIA if no media is provided", async () => {
      const result = await publishToTikTok(
        mockTargetId,
        { textContent: "No media post", mediaUrls: [] },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("MISSING_MEDIA");
      expect(result.platform).toBe("TIKTOK");
    });

    it("should publish video to TikTok init endpoint", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { publish_id: "tiktok-pub-123" },
          error: { code: "ok", message: "" },
        }),
      } as unknown as Response);

      const result = await publishToTikTok(
        mockTargetId,
        { textContent: "TikTok viral video", mediaUrls: ["https://example.com/tiktok.mp4"] },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(true);
      expect(result.platform).toBe("TIKTOK");
      expect(result.platformPostId).toBe("tiktok-pub-123");
    });

    it("should publish photo to TikTok content init endpoint", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { publish_id: "tiktok-photo-pub-456" },
          error: { code: "ok", message: "" },
        }),
      } as unknown as Response);

      const result = await publishToTikTok(
        mockTargetId,
        { textContent: "TikTok photo slideshow", mediaUrls: ["https://example.com/photo.jpg"] },
        mockAccount,
        mockAccessToken
      );

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe("tiktok-photo-pub-456");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://open.tiktokapis.com/v2/post/publish/content/init/",
        expect.anything()
      );
    });
  });
});
