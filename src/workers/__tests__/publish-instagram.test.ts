import { publishToInstagram } from "../publish-worker";

describe("publishToInstagram", () => {
  const originalFetch = global.fetch;
  const mockTargetId = "target-ig-123";
  const mockAccount = { platformAccountId: "ig-account-456" };
  const mockAccessToken = "mock-ig-access-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should return MISSING_MEDIA when post has no media", async () => {
    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Hello Instagram", mediaUrls: [] },
      mockAccount,
      mockAccessToken
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("MISSING_MEDIA");
    expect(result.platform).toBe("INSTAGRAM");
  });

  it("should fail when container response does not have creation ID", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}), // missing id
    } as unknown as Response);

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Caption", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("INVALID_CONTAINER_RESPONSE");
    expect(result.errorMessage).toContain("tidak mengembalikan creation ID");
  });

  it("should return failure when container creation fails", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 100,
          message: "Invalid parameter: video_url",
          type: "OAuthException",
        },
      }),
    } as unknown as Response);

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Caption", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 3 }
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("100");
    expect(result.errorMessage).toBe("Invalid parameter: video_url");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should successfully publish video when polling status is FINISHED on first attempt", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2. Status polling -> FINISHED
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status_code: "FINISHED", id: "creation-123" }),
    });
    // 3. Media publish -> success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "media-pub-789" }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 5 }
    );

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("media-pub-789");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Verify container creation params
    const createUrl = fetchMock.mock.calls[0][0];
    const createBody = fetchMock.mock.calls[0][1].body;
    expect(createUrl).toContain(`/${mockAccount.platformAccountId}/media`);
    expect(createBody).toContain("media_type=REELS");
    expect(createBody).toContain("video_url=https%3A%2F%2Fexample.com%2Fvideo.mp4");

    // Verify polling URL
    const pollUrl = fetchMock.mock.calls[1][0];
    expect(pollUrl).toContain("creation-123");
    expect(pollUrl).toContain("fields=status_code");

    // Verify publish URL
    const pubUrl = fetchMock.mock.calls[2][0];
    expect(pubUrl).toContain(`/${mockAccount.platformAccountId}/media_publish`);
  });

  it("should poll multiple times while IN_PROGRESS until FINISHED", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2. Status polling -> IN_PROGRESS
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status_code: "IN_PROGRESS", id: "creation-123" }),
    });
    // 3. Status polling -> FINISHED
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status_code: "FINISHED", id: "creation-123" }),
    });
    // 4. Media publish -> success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "media-pub-789" }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 5 }
    );

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("media-pub-789");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("should fail when container status returns ERROR without calling media_publish", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2. Status polling -> ERROR
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status_code: "ERROR",
        error_message: "Video file could not be decoded",
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 5 }
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("CONTAINER_PROCESSING_FAILED");
    expect(result.errorMessage).toContain("Video file could not be decoded");
    // media_publish should NOT be called
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should fail with CONTAINER_TIMEOUT when polling maxPolls is reached without FINISHED", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2-4. Status polling always IN_PROGRESS
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status_code: "IN_PROGRESS", id: "creation-123" }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 3 }
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("CONTAINER_TIMEOUT");
    expect(result.errorMessage).toBe(
      "Batas waktu pemrosesan media video di server Instagram terlampaui."
    );
    // 1 creation + 3 polls = 4 calls. media_publish should NOT be called.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("should fail with CONTAINER_EXPIRED when container status is EXPIRED", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2. Status polling -> EXPIRED
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status_code: "EXPIRED", id: "creation-123" }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 3 }
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("CONTAINER_EXPIRED");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should fail with auth error and needsReauth when token is invalid during polling", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2. Status polling -> 401 OAuthException
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 190,
          type: "OAuthException",
          message: "Error validating access token: Session has expired",
        },
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 3 }
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("190");
    expect(result.needsReauth).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should retry media_publish when receiving Error 9007 (Media ID is not available) and succeed on retry", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2. Status polling -> FINISHED
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status_code: "FINISHED", id: "creation-123" }),
    });
    // 3. Media publish attempt 1 -> Error 9007 ("Media ID is not available")
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 9007,
          message: "Media ID is not available",
          type: "OAuthException",
        },
      }),
    });
    // 4. Media publish attempt 2 (retry) -> Success!
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "media-pub-success-456" }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 3, publishRetryDelayMs: 1, maxPublishAttempts: 3 }
    );

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("media-pub-success-456");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("should retry media_publish when receiving error_subcode 2207027 (media not ready)", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2. Status polling -> FINISHED
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status_code: "FINISHED", id: "creation-123" }),
    });
    // 3. Media publish attempt 1 -> error_subcode 2207027
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 9007,
          error_subcode: 2207027,
          message: "The media is not ready for publishing, please wait for a moment",
          type: "OAuthException",
        },
      }),
    });
    // 4. Media publish attempt 2 -> Success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "media-pub-retry-ok" }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 3, publishRetryDelayMs: 1, maxPublishAttempts: 3 }
    );

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("media-pub-retry-ok");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("should retry media_publish when receiving error code 24 and succeed on retry", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2. Status polling -> FINISHED
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status_code: "FINISHED", id: "creation-123" }),
    });
    // 3. Media publish attempt 1 -> Error code 24
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 24,
          message: "Media is not ready for publishing yet",
          type: "OAuthException",
        },
      }),
    });
    // 4. Media publish attempt 2 -> Success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "media-pub-err24-retry-ok" }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 3, publishRetryDelayMs: 1, maxPublishAttempts: 3 }
    );

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("media-pub-err24-retry-ok");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("should recover and succeed when transient network failure occurs during status polling", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2. Status polling -> Network rejection
    fetchMock.mockRejectedValueOnce(new Error("Network glitch"));
    // 3. Status polling -> FINISHED
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status_code: "FINISHED", id: "creation-123" }),
    });
    // 4. Media publish -> success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "media-pub-transient-ok" }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 5 }
    );

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("media-pub-transient-ok");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("should fail when all media_publish retries return Error 9007", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2. Status polling -> FINISHED
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status_code: "FINISHED", id: "creation-123" }),
    });
    // 3. Media publish attempt 1 -> Error 9007
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: 9007, message: "Media ID is not available" },
      }),
    });
    // 4. Media publish attempt 2 -> Error 9007
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: 9007, message: "Media ID is not available" },
      }),
    });
    // 5. Media publish attempt 3 -> Error 9007
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: 9007, message: "Media ID is not available" },
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 3, publishRetryDelayMs: 1, maxPublishAttempts: 3 }
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("9007");
    expect(result.errorMessage).toBe("Media ID is not available");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("should not retry media_publish for non-retryable error (e.g. invalid permission code 10)", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "creation-123" }),
    });
    // 2. Status polling -> FINISHED
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status_code: "FINISHED", id: "creation-123" }),
    });
    // 3. Media publish -> Non-retryable error
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: 10, message: "Permission Denied", type: "OAuthException" },
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Reels video", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken,
      5000,
      { pollIntervalMs: 1, maxPolls: 3, publishRetryDelayMs: 1, maxPublishAttempts: 3 }
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("10");
    // Should NOT retry after error 10
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("should publish image without video container status polling", async () => {
    const fetchMock = jest.fn();
    // 1. Container creation for image
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "image-container-123" }),
    });
    // 2. Media publish -> Success directly
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "photo-pub-999" }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Photo post", mediaUrls: ["https://example.com/photo.jpg"] },
      mockAccount,
      mockAccessToken
    );

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("photo-pub-999");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const createBody = fetchMock.mock.calls[0][1].body;
    expect(createBody).toContain("image_url=https%3A%2F%2Fexample.com%2Fphoto.jpg");
    expect(createBody).not.toContain("media_type=REELS");
  });

  it("should handle TimeoutError gracefully", async () => {
    const timeoutErr = new Error("Request timed out after 5000ms");
    timeoutErr.name = "TimeoutError";
    global.fetch = jest.fn().mockRejectedValueOnce(timeoutErr);

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Video post", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("TIMEOUT");
    expect(result.errorMessage).toContain("Request timed out");
  });

  it("should handle general network fetch error gracefully", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("Connection refused"));

    const result = await publishToInstagram(
      mockTargetId,
      { textContent: "Video post", mediaUrls: ["https://example.com/video.mp4"] },
      mockAccount,
      mockAccessToken
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("FETCH_ERROR");
    expect(result.errorMessage).toBe("Connection refused");
  });
});
