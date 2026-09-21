import { PostManager, PostManagerError } from "../post-manager";
import * as platformAdaptersModule from "../platform-adapters";
import * as cryptoModule from "@/lib/crypto";
import { db } from "@/lib/db";
import { getPublishQueue } from "@/lib/queue/publish-queue";
import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/posts/[id]/route";
import { authService } from "@/lib/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import {
  hasPublishedTargets,
  getPublishedTargets,
  formatPlatformDisplayName,
  formatDeleteFeedbackMessage,
} from "../post-delete-helpers";

// Mocks
jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/lib/queue/publish-queue", () => ({
  getPublishQueue: jest.fn(() => ({
    remove: jest.fn(),
    getJob: jest.fn(),
    getDelayed: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock("@/lib/crypto", () => ({
  decrypt: jest.fn((val: string) => `decrypted-${val}`),
  encrypt: jest.fn((val: string) => `encrypted-${val}`),
}));

jest.mock("@/lib/services/auth-service", () => ({
  authService: {
    validateSession: jest.fn(),
  },
}));

describe("QC Validation: End-to-End & Edge Cases for Post Deletion", () => {
  const originalFetch = global.fetch;
  const mockedDb = db as unknown as {
    select: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
  };
  const mockedGetPublishQueue = getPublishQueue as unknown as jest.Mock;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Platform Adapters: Granular Error & Timeout Scenarios
  // =========================================================================
  describe("Platform Adapters Edge Cases", () => {
    describe("Meta / Facebook Deletion", () => {
      it("should handle error code 803 (aliases do not exist) as alreadyDeleted", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              code: 803,
              message: "Some of the aliases you requested do not exist",
            },
          }),
        } as unknown as Response);

        const res = await platformAdaptersModule.deleteFromMeta(
          "target-fb-803",
          "fb_post_803",
          "token-803"
        );

        expect(res.success).toBe(true);
        expect(res.alreadyDeleted).toBe(true);
      });

      it("should handle error subcode 467 as TOKEN_EXPIRED and needsReauth", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              code: 190,
              error_subcode: 467,
              message: "Error validating access token: Session is invalid.",
            },
          }),
        } as unknown as Response);

        const res = await platformAdaptersModule.deleteFromMeta(
          "target-fb-467",
          "fb_post_467",
          "token-467"
        );

        expect(res.success).toBe(false);
        expect(res.needsReauth).toBe(true);
        expect(res.errorCode).toBe("TOKEN_EXPIRED");
      });

      it("should handle non-JSON error response from Facebook gracefully", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => {
            throw new Error("Invalid JSON");
          },
        } as unknown as Response);

        const res = await platformAdaptersModule.deleteFromMeta(
          "target-fb-502",
          "fb_post_502",
          "token-502"
        );

        expect(res.success).toBe(false);
        expect(res.errorCode).toBe("502");
      });

      it("should catch TimeoutError on Meta deletion", async () => {
        const abortErr = new Error("The operation was aborted");
        abortErr.name = "AbortError";
        global.fetch = jest.fn().mockRejectedValueOnce(abortErr);

        const res = await platformAdaptersModule.deleteFromMeta(
          "target-fb-timeout",
          "fb_post_timeout",
          "token-fb",
          undefined,
          50
        );

        expect(res.success).toBe(false);
        expect(res.errorCode).toBe("TIMEOUT");
        expect(res.errorMessage).toContain("Request timeout");
      });
    });

    describe("Instagram Deletion", () => {
      it("should handle error code 24 (object does not exist) as alreadyDeleted", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({
            error: {
              code: 24,
              message: "Object does not exist",
            },
          }),
        } as unknown as Response);

        const res = await platformAdaptersModule.deleteFromInstagram(
          "target-ig-24",
          "ig_media_24",
          "token-ig"
        );

        expect(res.success).toBe(true);
        expect(res.alreadyDeleted).toBe(true);
      });

      it("should catch TimeoutError on Instagram deletion", async () => {
        const abortErr = new Error("The operation was aborted");
        abortErr.name = "AbortError";
        global.fetch = jest.fn().mockRejectedValueOnce(abortErr);

        const res = await platformAdaptersModule.deleteFromInstagram(
          "target-ig-timeout",
          "ig_media_timeout",
          "token-ig",
          undefined,
          50
        );

        expect(res.success).toBe(false);
        expect(res.errorCode).toBe("TIMEOUT");
      });
    });

    describe("Threads Deletion", () => {
      it("should handle code 100 with 'not found' message as alreadyDeleted", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              code: 100,
              message: "Media not found or deleted",
            },
          }),
        } as unknown as Response);

        const res = await platformAdaptersModule.deleteFromThreads(
          "target-th-100",
          "th_media_100",
          "token-th"
        );

        expect(res.success).toBe(true);
        expect(res.alreadyDeleted).toBe(true);
      });

      it("should catch TimeoutError on Threads deletion", async () => {
        const abortErr = new Error("The operation was aborted");
        abortErr.name = "AbortError";
        global.fetch = jest.fn().mockRejectedValueOnce(abortErr);

        const res = await platformAdaptersModule.deleteFromThreads(
          "target-th-timeout",
          "th_media_timeout",
          "token-th",
          undefined,
          50
        );

        expect(res.success).toBe(false);
        expect(res.errorCode).toBe("TIMEOUT");
      });
    });

    describe("TikTok Deletion", () => {
      it("should handle publish_id_not_found error as alreadyDeleted", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({
            error: {
              code: "publish_id_not_found",
              message: "Publish ID is not found",
            },
          }),
        } as unknown as Response);

        const res = await platformAdaptersModule.deleteFromTikTok(
          "target-tt-pub",
          "tt_video_pub",
          "token-tt"
        );

        expect(res.success).toBe(true);
        expect(res.alreadyDeleted).toBe(true);
      });

      it("should handle scope_not_authorized as unsupported gracefully", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({
            error: {
              code: "scope_not_authorized",
              message: "Scope video.delete is not authorized for this client",
            },
          }),
        } as unknown as Response);

        const res = await platformAdaptersModule.deleteFromTikTok(
          "target-tt-scope",
          "tt_video_scope",
          "token-tt"
        );

        expect(res.success).toBe(true);
        expect(res.unsupported).toBe(true);
        expect(res.warning).toContain("TikTok Content Posting API");
      });

      it("should handle TikTok generic error code properly", async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            error: {
              code: "internal_error",
              message: "TikTok server error",
            },
          }),
        } as unknown as Response);

        const res = await platformAdaptersModule.deleteFromTikTok(
          "target-tt-err",
          "tt_video_err",
          "token-tt"
        );

        expect(res.success).toBe(false);
        expect(res.errorCode).toBe("internal_error");
        expect(res.errorMessage).toBe("TikTok server error");
      });

      it("should catch TimeoutError on TikTok deletion", async () => {
        const abortErr = new Error("The operation was aborted");
        abortErr.name = "AbortError";
        global.fetch = jest.fn().mockRejectedValueOnce(abortErr);

        const res = await platformAdaptersModule.deleteFromTikTok(
          "target-tt-timeout",
          "tt_video_timeout",
          "token-tt",
          undefined,
          50
        );

        expect(res.success).toBe(false);
        expect(res.errorCode).toBe("TIMEOUT");
      });
    });
  });

  // =========================================================================
  // 2. PostManager.deletePost: Comprehensive Integration & Failure Modes
  // =========================================================================
  describe("PostManager.deletePost Integration Scenarios", () => {
    let postManager: PostManager;

    beforeEach(() => {
      postManager = new PostManager();
    });

    it("Scenario: Multi-platform deletion with mixed outcomes (success, already deleted, unsupported, auth expired)", async () => {
      // Mock postRow
      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          {
            id: "post-multi-1",
            userId: "user-1",
            status: "PUBLISHED",
          },
        ]),
      });

      // Mock 4 published targets
      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          {
            id: "t-meta",
            connectedAccountId: "acc-meta",
            platform: "META_PAGE",
            status: "PUBLISHED",
            platformPostId: "fb-111",
          },
          {
            id: "t-ig",
            connectedAccountId: "acc-ig",
            platform: "INSTAGRAM",
            status: "PUBLISHED",
            platformPostId: "ig-222",
          },
          {
            id: "t-threads",
            connectedAccountId: "acc-threads",
            platform: "THREADS",
            status: "PUBLISHED",
            platformPostId: "th-333",
          },
          {
            id: "t-tiktok",
            connectedAccountId: "acc-tiktok",
            platform: "TIKTOK",
            status: "PUBLISHED",
            platformPostId: "tt-444",
          },
        ]),
      });

      // Mock connected accounts
      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { id: "acc-meta", platform: "META_PAGE", accessTokenEnc: "enc-meta" },
          { id: "acc-ig", platform: "INSTAGRAM", accessTokenEnc: "enc-ig" },
          { id: "acc-threads", platform: "THREADS", accessTokenEnc: "enc-th" },
          { id: "acc-tiktok", platform: "TIKTOK", accessTokenEnc: "enc-tt" },
        ]),
      });

      // Mock deleteFromPlatform spy to simulate 4 distinct platform outcomes
      jest
        .spyOn(platformAdaptersModule, "deleteFromPlatform")
        .mockImplementation(async (platform, targetId, platformPostId) => {
          if (platform === "META_PAGE") {
            return { targetId, platform, platformPostId, success: true };
          }
          if (platform === "INSTAGRAM") {
            return {
              targetId,
              platform,
              platformPostId,
              success: true,
              alreadyDeleted: true,
              errorMessage: "Postingan sudah dihapus sebelumnya dari Instagram.",
            };
          }
          if (platform === "THREADS") {
            return {
              targetId,
              platform,
              platformPostId,
              success: false,
              needsReauth: true,
              errorCode: "TOKEN_EXPIRED",
              errorMessage: "Session expired",
            };
          }
          // TIKTOK
          return {
            targetId,
            platform,
            platformPostId,
            success: true,
            unsupported: true,
            warning: "TikTok Content Posting API saat ini belum mendukung penghapusan video.",
          };
        });

      // Mock DB update for NEEDS_REAUTH
      const updateMock = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };
      mockedDb.update.mockReturnValueOnce(updateMock);

      // Mock DB delete post
      mockedDb.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: "post-multi-1" }]),
      });

      const result = await postManager.deletePost("user-1", "post-multi-1", {
        deleteOnPlatforms: true,
      });

      expect(result.success).toBe(true);
      expect(result.deletedPostId).toBe("post-multi-1");
      expect(result.platformResults).toHaveLength(4);

      const meta = result.platformResults?.find((r) => r.platform === "META_PAGE");
      expect(meta?.success).toBe(true);

      const ig = result.platformResults?.find((r) => r.platform === "INSTAGRAM");
      expect(ig?.success).toBe(true);
      expect(ig?.alreadyDeleted).toBe(true);

      const th = result.platformResults?.find((r) => r.platform === "THREADS");
      expect(th?.success).toBe(false);
      expect(th?.needsReauth).toBe(true);

      const tt = result.platformResults?.find((r) => r.platform === "TIKTOK");
      expect(tt?.success).toBe(true);
      expect(tt?.unsupported).toBe(true);

      // Verify connected_accounts was updated ONLY for Threads
      expect(mockedDb.update).toHaveBeenCalled();
      expect(updateMock.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: "NEEDS_REAUTH" })
      );
    });

    it("Scenario: Connected account missing from DB for a target", async () => {
      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: "post-acc-missing", userId: "user-1", status: "PUBLISHED" }]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          {
            id: "t-orphan",
            connectedAccountId: "acc-nonexistent",
            platform: "META_PAGE",
            status: "PUBLISHED",
            platformPostId: "fb-orphan",
          },
        ]),
      });

      // Return empty array for connected accounts
      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      });

      mockedDb.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: "post-acc-missing" }]),
      });

      const result = await postManager.deletePost("user-1", "post-acc-missing", {
        deleteOnPlatforms: true,
      });

      expect(result.success).toBe(true);
      expect(result.platformResults).toHaveLength(1);
      expect(result.platformResults?.[0]).toEqual({
        targetId: "t-orphan",
        platform: "META_PAGE",
        platformPostId: "fb-orphan",
        success: false,
        errorCode: "ACCOUNT_NOT_FOUND",
        errorMessage: "Akun platform yang terhubung tidak ditemukan.",
      });
    });

    it("Scenario: Access token decryption failure does not crash post deletion", async () => {
      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: "post-decrypt-err", userId: "user-1", status: "PUBLISHED" }]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          {
            id: "t-corrupt",
            connectedAccountId: "acc-corrupt",
            platform: "META_PAGE",
            status: "PUBLISHED",
            platformPostId: "fb-corrupt",
          },
        ]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { id: "acc-corrupt", platform: "META_PAGE", accessTokenEnc: "corrupted-payload" },
        ]),
      });

      jest.spyOn(cryptoModule, "decrypt").mockImplementationOnce(() => {
        throw new Error("Decryption failed: bad auth tag");
      });

      mockedDb.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: "post-decrypt-err" }]),
      });

      const result = await postManager.deletePost("user-1", "post-decrypt-err", {
        deleteOnPlatforms: true,
      });

      expect(result.success).toBe(true);
      expect(result.platformResults).toHaveLength(1);
      expect(result.platformResults?.[0]).toEqual({
        targetId: "t-corrupt",
        platform: "META_PAGE",
        platformPostId: "fb-corrupt",
        success: false,
        errorCode: "DECRYPT_ERROR",
        errorMessage: "Gagal mendekripsi token akses akun.",
      });
    });

    it("Scenario: Scheduled post without meta.bullmq_job_id searches and cancels in delayed queue", async () => {
      const mockJobRemove = jest.fn().mockResolvedValue(undefined);
      mockedGetPublishQueue.mockReturnValueOnce({
        remove: jest.fn(),
        getJob: jest.fn(),
        getDelayed: jest.fn().mockResolvedValue([
          { id: "job-1", data: { postId: "other-post" }, remove: jest.fn() },
          { id: "job-2", data: { postId: "post-sched-delayed" }, remove: mockJobRemove },
        ]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { id: "post-sched-delayed", userId: "user-1", status: "SCHEDULED", meta: {} },
        ]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      });

      mockedDb.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: "post-sched-delayed" }]),
      });

      const result = await postManager.deletePost("user-1", "post-sched-delayed");
      expect(result.success).toBe(true);
      expect(mockJobRemove).toHaveBeenCalled();
    });

    it("Scenario: Scheduled post with metaJobId falls back to queue.getJob if queue.remove fails", async () => {
      const mockJobRemove = jest.fn().mockResolvedValue(undefined);
      mockedGetPublishQueue.mockReturnValueOnce({
        remove: jest.fn().mockRejectedValueOnce(new Error("Direct remove failed")),
        getJob: jest.fn().mockResolvedValueOnce({ remove: mockJobRemove }),
        getDelayed: jest.fn().mockResolvedValue([]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { id: "post-fallback-job", userId: "user-1", status: "SCHEDULED", meta: { bullmq_job_id: "bull-job-fb" } },
        ]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      });

      mockedDb.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: "post-fallback-job" }]),
      });

      const result = await postManager.deletePost("user-1", "post-fallback-job");
      expect(result.success).toBe(true);
      expect(mockJobRemove).toHaveBeenCalled();
    });

    it("Scenario: Post has targets but none are eligible (none PUBLISHED or platformPostId missing)", async () => {
      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: "post-draft-targets", userId: "user-1", status: "DRAFT" }]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          {
            id: "t-draft-1",
            connectedAccountId: "acc-1",
            platform: "META_PAGE",
            status: "DRAFT",
            platformPostId: null,
          },
        ]),
      });

      mockedDb.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: "post-draft-targets" }]),
      });

      const result = await postManager.deletePost("user-1", "post-draft-targets", {
        deleteOnPlatforms: true,
      });

      expect(result.success).toBe(true);
      expect(result.platformResults).toEqual([]);
    });

    it("Scenario: DB delete returns empty result throws 404 NOT_FOUND", async () => {
      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: "post-disappeared", userId: "user-1", status: "DRAFT" }]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      });

      mockedDb.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      });

      await expect(
        postManager.deletePost("user-1", "post-disappeared")
      ).rejects.toThrow(new PostManagerError("NOT_FOUND", 404, "Post tidak ditemukan."));
    });

    it("Scenario: BullMQ queue failure does not block post deletion", async () => {
      mockedGetPublishQueue.mockImplementationOnce(() => {
        throw new Error("Redis connection refused");
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { id: "post-queue-down", userId: "user-1", status: "SCHEDULED", meta: { bullmq_job_id: "job-99" } },
        ]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      });

      mockedDb.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: "post-queue-down" }]),
      });

      const result = await postManager.deletePost("user-1", "post-queue-down");
      expect(result.success).toBe(true);
      expect(result.deletedPostId).toBe("post-queue-down");
    });

    it("Scenario: syncDelete alias option works identical to deleteOnPlatforms", async () => {
      const deleteFromPlatformSpy = jest
        .spyOn(platformAdaptersModule, "deleteFromPlatform")
        .mockResolvedValueOnce({
          targetId: "t-sync",
          platform: "META_PAGE",
          platformPostId: "fb-sync",
          success: true,
        });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: "post-sync-alias", userId: "user-1", status: "PUBLISHED" }]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          {
            id: "t-sync",
            connectedAccountId: "acc-sync",
            platform: "META_PAGE",
            status: "PUBLISHED",
            platformPostId: "fb-sync",
          },
        ]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { id: "acc-sync", platform: "META_PAGE", accessTokenEnc: "enc-sync" },
        ]),
      });

      mockedDb.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: "post-sync-alias" }]),
      });

      const result = await postManager.deletePost("user-1", "post-sync-alias", {
        syncDelete: true,
      });

      expect(result.success).toBe(true);
      expect(deleteFromPlatformSpy).toHaveBeenCalled();
      expect(result.platformResults).toHaveLength(1);
    });

    it("Scenario: Unhandled exception during deleteFromPlatform is mapped to DELETE_EXCEPTION", async () => {
      jest
        .spyOn(platformAdaptersModule, "deleteFromPlatform")
        .mockRejectedValueOnce(new Error("Fatal memory issue"));

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: "post-exc", userId: "user-1", status: "PUBLISHED" }]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          {
            id: "t-exc",
            connectedAccountId: "acc-exc",
            platform: "META_PAGE",
            status: "PUBLISHED",
            platformPostId: "fb-exc",
          },
        ]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { id: "acc-exc", platform: "META_PAGE", accessTokenEnc: "enc-exc" },
        ]),
      });

      mockedDb.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: "post-exc" }]),
      });

      const result = await postManager.deletePost("user-1", "post-exc", {
        deleteOnPlatforms: true,
      });

      expect(result.success).toBe(true);
      expect(result.platformResults?.[0]?.errorCode).toBe("DELETE_EXCEPTION");
      expect(result.platformResults?.[0]?.errorMessage).toBe("Fatal memory issue");
    });

    it("Scenario: Promise.allSettled rejected promise mapped to UNHANDLED_EXCEPTION", async () => {
      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: "post-settle-rej", userId: "user-1", status: "PUBLISHED" }]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          {
            id: "t-rej",
            connectedAccountId: "acc-rej",
            platform: "META_PAGE",
            status: "PUBLISHED",
            platformPostId: "fb-rej",
          },
        ]),
      });

      mockedDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { id: "acc-rej", platform: "META_PAGE", accessTokenEnc: "enc-rej" },
        ]),
      });

      mockedDb.delete.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: "post-settle-rej" }]),
      });

      jest.spyOn(Promise, "allSettled").mockResolvedValueOnce([
        {
          status: "rejected",
          reason: new Error("Async thread rejected"),
        } as PromiseRejectedResult,
      ]);

      const result = await postManager.deletePost("user-1", "post-settle-rej", {
        deleteOnPlatforms: true,
      });

      expect(result.success).toBe(true);
      expect(result.platformResults?.[0]?.errorCode).toBe("UNHANDLED_EXCEPTION");
      expect(result.platformResults?.[0]?.errorMessage).toBe("Async thread rejected");
    });
  });

  // =========================================================================
  // 3. API Route DELETE /api/posts/[id] Robustness
  // =========================================================================
  describe("API Route DELETE /api/posts/[id] Edge Cases", () => {
    it("should accept deleteOnPlatforms=1 or syncDelete=1 query param", async () => {
      (authService.validateSession as jest.Mock).mockResolvedValueOnce({ id: "user-1" });
      const deletePostSpy = jest
        .spyOn(PostManager.prototype, "deletePost")
        .mockResolvedValueOnce({ success: true, deletedPostId: "p-1" });

      const req = new NextRequest("http://localhost:3000/api/posts/p-1?syncDelete=1", {
        method: "DELETE",
        headers: { cookie: `${SESSION_COOKIE_NAME}=token` },
      });

      const res = await DELETE(req, { params: Promise.resolve({ id: "p-1" }) });
      expect(res.status).toBe(200);
      expect(deletePostSpy).toHaveBeenCalledWith("user-1", "p-1", { deleteOnPlatforms: true });
    });

    it("should parse syncDelete from JSON body", async () => {
      (authService.validateSession as jest.Mock).mockResolvedValueOnce({ id: "user-1" });
      const deletePostSpy = jest
        .spyOn(PostManager.prototype, "deletePost")
        .mockResolvedValueOnce({ success: true, deletedPostId: "p-2" });

      const req = new NextRequest("http://localhost:3000/api/posts/p-2", {
        method: "DELETE",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=token`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ syncDelete: true }),
      });

      const res = await DELETE(req, { params: Promise.resolve({ id: "p-2" }) });
      expect(res.status).toBe(200);
      expect(deletePostSpy).toHaveBeenCalledWith("user-1", "p-2", { deleteOnPlatforms: true });
    });

    it("should return 500 INTERNAL if deletePost throws an unexpected error", async () => {
      (authService.validateSession as jest.Mock).mockResolvedValueOnce({ id: "user-1" });
      jest.spyOn(PostManager.prototype, "deletePost").mockRejectedValueOnce(new Error("Unexpected DB crash"));

      const req = new NextRequest("http://localhost:3000/api/posts/p-crash", {
        method: "DELETE",
        headers: { cookie: `${SESSION_COOKIE_NAME}=token` },
      });

      const res = await DELETE(req, { params: Promise.resolve({ id: "p-crash" }) });
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error.code).toBe("INTERNAL");
    });
  });

  // =========================================================================
  // 4. UI Helper Functions Edge Cases
  // =========================================================================
  describe("Post Delete Helpers Edge Cases", () => {
    it("hasPublishedTargets returns true for PARTIAL post", () => {
      expect(hasPublishedTargets({ id: "1", status: "PARTIAL" })).toBe(true);
    });

    it("hasPublishedTargets returns true if target has platformPostId even if status is not PUBLISHED", () => {
      expect(
        hasPublishedTargets({
          id: "1",
          status: "DRAFT",
          targets: [{ platform: "META_PAGE", platformPostId: "fb-123", status: "PENDING" }],
        })
      ).toBe(true);
    });

    it("hasPublishedTargets returns false for post with no targets", () => {
      expect(hasPublishedTargets({ id: "1", status: "DRAFT", targets: [] })).toBe(false);
      expect(hasPublishedTargets(null)).toBe(false);
    });

    it("getPublishedTargets filters targets correctly", () => {
      expect(getPublishedTargets(null)).toEqual([]);
      expect(getPublishedTargets({ id: "1", status: "DRAFT", targets: [] })).toEqual([]);

      const samplePost = {
        id: "post-sample",
        status: "DRAFT",
        targets: [
          { platform: "META_PAGE", status: "PUBLISHED", platformPostId: "fb-1" },
          { platform: "INSTAGRAM", status: "FAILED", platformPostId: "ig-2" },
          { platform: "THREADS", status: "FAILED", platformPostId: null },
        ],
      };

      const published = getPublishedTargets(samplePost);
      expect(published).toHaveLength(2);
      expect(published.map((t) => t.platform)).toEqual(["META_PAGE", "INSTAGRAM"]);
    });

    it("formatPlatformDisplayName returns raw string for unknown platform", () => {
      expect(formatPlatformDisplayName("CUSTOM_NETWORK")).toBe("CUSTOM_NETWORK");
    });

    it("formatDeleteFeedbackMessage with only unsupported platforms", () => {
      const result = formatDeleteFeedbackMessage({
        deleteOnPlatforms: true,
        platformResults: [
          {
            targetId: "t-1",
            platform: "TIKTOK",
            platformPostId: "tt-1",
            success: true,
            unsupported: true,
          },
        ],
      });

      expect(result.type).toBe("success");
      expect(result.message).toContain("tidak mendukung penghapusan otomatis via API");
    });

    it("formatDeleteFeedbackMessage with mixed failures returns info banner", () => {
      const result = formatDeleteFeedbackMessage({
        deleteOnPlatforms: true,
        platformResults: [
          {
            targetId: "t-1",
            platform: "META_PAGE",
            platformPostId: "fb-1",
            success: true,
          },
          {
            targetId: "t-2",
            platform: "THREADS",
            platformPostId: "th-1",
            success: false,
            errorMessage: "Token invalid",
          },
        ],
      });

      expect(result.type).toBe("info");
      expect(result.message).toContain("Konten di Facebook Page berhasil dihapus.");
      expect(result.message).toContain("Gagal menghapus konten di Threads.");
    });
  });
});
