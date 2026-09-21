import { type PlatformType } from "@/lib/db/schema";
import {
  deleteFromMeta,
  deleteFromInstagram,
  deleteFromThreads,
  deleteFromTikTok,
  deleteFromPlatform,
  platformAdapters,
  metaAdapter,
  facebookAdapter,
  instagramAdapter,
  threadsAdapter,
  tiktokAdapter,
} from "../platform-adapters";

describe("Platform Deletion Adapters", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe("deleteFromMeta (Facebook)", () => {
    it("should successfully delete a post via Facebook Graph API", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as unknown as Response);

      const result = await deleteFromMeta(
        "target-meta-1",
        "fb_post_12345",
        { platformAccountId: "page_111" },
        "valid-token"
      );

      expect(result.success).toBe(true);
      expect(result.platform).toBe("META_PAGE");
      expect(result.platformPostId).toBe("fb_post_12345");
      expect(result.alreadyDeleted).toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://graph.facebook.com/v19.0/fb_post_12345?access_token=valid-token",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should gracefully handle post already deleted by user on Facebook (error code 100)", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message:
              "Unsupported delete request. Object with ID 'fb_post_12345' does not exist, cannot be loaded due to missing permissions, or does not support this operation.",
            type: "GraphMethodException",
            code: 100,
          },
        }),
      } as unknown as Response);

      const result = await deleteFromMeta("target-meta-1", "fb_post_12345", "valid-token");

      expect(result.success).toBe(true);
      expect(result.alreadyDeleted).toBe(true);
      expect(result.errorMessage).toContain("sudah dihapus sebelumnya");
    });

    it("should gracefully handle HTTP 404 not found on Facebook", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            message: "Object does not exist",
            code: 24,
          },
        }),
      } as unknown as Response);

      const result = await deleteFromMeta("target-meta-1", "fb_post_12345", "valid-token");

      expect(result.success).toBe(true);
      expect(result.alreadyDeleted).toBe(true);
    });

    it("should report needsReauth when access token is invalid or expired", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: "Error validating access token: Session has expired.",
            type: "OAuthException",
            code: 190,
            error_subcode: 463,
          },
        }),
      } as unknown as Response);

      const result = await deleteFromMeta("target-meta-1", "fb_post_12345", "expired-token");

      expect(result.success).toBe(false);
      expect(result.needsReauth).toBe(true);
      expect(result.errorCode).toBe("TOKEN_EXPIRED");
    });

    it("should handle network or timeout errors gracefully", async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error("Connection reset by peer"));

      const result = await deleteFromMeta("target-meta-1", "fb_post_12345", "valid-token");

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("FETCH_ERROR");
      expect(result.errorMessage).toContain("Connection reset by peer");
    });
  });

  describe("deleteFromInstagram", () => {
    it("should successfully delete a media container via Instagram Graph API", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as unknown as Response);

      const result = await deleteFromInstagram(
        "target-ig-1",
        "ig_media_67890",
        { platformAccountId: "ig_user_1" },
        "valid-ig-token"
      );

      expect(result.success).toBe(true);
      expect(result.platform).toBe("INSTAGRAM");
      expect(result.platformPostId).toBe("ig_media_67890");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://graph.facebook.com/v19.0/ig_media_67890?access_token=valid-ig-token",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should gracefully handle post already removed directly from Instagram", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "Object with ID 'ig_media_67890' does not exist",
            code: 100,
          },
        }),
      } as unknown as Response);

      const result = await deleteFromInstagram("target-ig-1", "ig_media_67890", "valid-ig-token");

      expect(result.success).toBe(true);
      expect(result.alreadyDeleted).toBe(true);
      expect(result.errorMessage).toContain("Instagram");
    });

    it("should handle Instagram OAuth authentication error", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: "Session expired",
            type: "OAuthException",
            code: 190,
          },
        }),
      } as unknown as Response);

      const result = await deleteFromInstagram("target-ig-1", "ig_media_67890", "expired-token");

      expect(result.success).toBe(false);
      expect(result.needsReauth).toBe(true);
      expect(result.errorCode).toBe("TOKEN_EXPIRED");
    });
  });

  describe("deleteFromThreads", () => {
    it("should successfully delete a thread via Threads API", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as unknown as Response);

      const result = await deleteFromThreads(
        "target-threads-1",
        "threads_media_999",
        { platformAccountId: "threads_user_1" },
        "valid-threads-token"
      );

      expect(result.success).toBe(true);
      expect(result.platform).toBe("THREADS");
      expect(result.platformPostId).toBe("threads_media_999");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://graph.threads.net/v1.0/threads_media_999?access_token=valid-threads-token",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should gracefully handle thread already deleted by user on Threads", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            message: "The requested resource does not exist",
            code: 24,
          },
        }),
      } as unknown as Response);

      const result = await deleteFromThreads(
        "target-threads-1",
        "threads_media_999",
        "valid-threads-token"
      );

      expect(result.success).toBe(true);
      expect(result.alreadyDeleted).toBe(true);
      expect(result.errorMessage).toContain("Threads");
    });

    it("should handle Threads authentication error", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: "Invalid OAuth access token",
            code: 190,
          },
        }),
      } as unknown as Response);

      const result = await deleteFromThreads(
        "target-threads-1",
        "threads_media_999",
        "expired-token"
      );

      expect(result.success).toBe(false);
      expect(result.needsReauth).toBe(true);
      expect(result.errorCode).toBe("TOKEN_EXPIRED");
    });
  });

  describe("deleteFromTikTok", () => {
    it("should successfully delete a video via TikTok API if supported", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {},
          error: { code: "ok", message: "" },
        }),
      } as unknown as Response);

      const result = await deleteFromTikTok(
        "target-tiktok-1",
        "tiktok_video_777",
        { platformAccountId: "tiktok_acc_1" },
        "valid-tiktok-token"
      );

      expect(result.success).toBe(true);
      expect(result.platform).toBe("TIKTOK");
      expect(result.platformPostId).toBe("tiktok_video_777");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://open.tiktokapis.com/v2/post/publish/video/tiktok_video_777",
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Authorization: "Bearer valid-tiktok-token",
          }),
        })
      );
    });

    it("should gracefully handle video already deleted on TikTok", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: "video_not_found",
            message: "Video not found",
          },
        }),
      } as unknown as Response);

      const result = await deleteFromTikTok(
        "target-tiktok-1",
        "tiktok_video_777",
        "valid-tiktok-token"
      );

      expect(result.success).toBe(true);
      expect(result.alreadyDeleted).toBe(true);
      expect(result.errorMessage).toContain("TikTok");
    });

    it("should gracefully handle unsupported deletion in TikTok Content Posting API", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 405,
        json: async () => ({
          error: {
            code: "unsupported_action",
            message: "Method Not Allowed or action not supported",
          },
        }),
      } as unknown as Response);

      const result = await deleteFromTikTok(
        "target-tiktok-1",
        "tiktok_video_777",
        "valid-tiktok-token"
      );

      expect(result.success).toBe(true);
      expect(result.unsupported).toBe(true);
      expect(result.warning).toContain("TikTok Content Posting API");
    });

    it("should handle TikTok authentication expiration", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: "access_token_invalid",
            message: "Access token is invalid or expired",
          },
        }),
      } as unknown as Response);

      const result = await deleteFromTikTok("target-tiktok-1", "tiktok_video_777", "expired-token");

      expect(result.success).toBe(false);
      expect(result.needsReauth).toBe(true);
      expect(result.errorCode).toBe("TOKEN_EXPIRED");
    });
  });

  describe("deleteFromPlatform and Adapters Registry", () => {
    it("should route to the appropriate platform adapter", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as unknown as Response);

      const resMeta = await deleteFromPlatform("META_PAGE", "t-1", "p-1", "tok-1");
      expect(resMeta.platform).toBe("META_PAGE");

      const resIg = await deleteFromPlatform("INSTAGRAM", "t-2", "p-2", "tok-2");
      expect(resIg.platform).toBe("INSTAGRAM");

      const resThreads = await deleteFromPlatform("THREADS", "t-3", "p-3", "tok-3");
      expect(resThreads.platform).toBe("THREADS");
    });

    it("should return error for unsupported platform type", async () => {
      const res = await deleteFromPlatform(
        "UNKNOWN" as unknown as PlatformType,
        "t-99",
        "p-99",
        "tok-99"
      );

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("UNSUPPORTED_PLATFORM");
    });

    it("should have individual adapter objects properly defined", () => {
      expect(metaAdapter.platform).toBe("META_PAGE");
      expect(facebookAdapter).toBe(metaAdapter);
      expect(instagramAdapter.platform).toBe("INSTAGRAM");
      expect(threadsAdapter.platform).toBe("THREADS");
      expect(tiktokAdapter.platform).toBe("TIKTOK");
      expect(platformAdapters.META_PAGE).toBe(metaAdapter);
      expect(platformAdapters.INSTAGRAM).toBe(instagramAdapter);
      expect(platformAdapters.THREADS).toBe(threadsAdapter);
      expect(platformAdapters.TIKTOK).toBe(tiktokAdapter);
    });
  });
});
