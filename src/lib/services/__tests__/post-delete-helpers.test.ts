import {
  hasPublishedTargets,
  getPublishedTargets,
  formatPlatformDisplayName,
  formatDeleteFeedbackMessage,
  type PostWithTargetsSummary,
} from "../post-delete-helpers";

describe("post-delete-helpers", () => {
  describe("hasPublishedTargets", () => {
    it("should return false for null or undefined post", () => {
      expect(hasPublishedTargets(null)).toBe(false);
      expect(hasPublishedTargets(undefined)).toBe(false);
    });

    it("should return true if post status is PUBLISHED", () => {
      const post: PostWithTargetsSummary = {
        id: "p-1",
        status: "PUBLISHED",
        targets: [],
      };
      expect(hasPublishedTargets(post)).toBe(true);
    });

    it("should return true if post status is PARTIAL", () => {
      const post: PostWithTargetsSummary = {
        id: "p-2",
        status: "PARTIAL",
        targets: [],
      };
      expect(hasPublishedTargets(post)).toBe(true);
    });

    it("should return true if at least one target is PUBLISHED", () => {
      const post: PostWithTargetsSummary = {
        id: "p-3",
        status: "DRAFT",
        targets: [
          { platform: "META_PAGE", status: "DRAFT" },
          { platform: "INSTAGRAM", status: "PUBLISHED", platformPostId: "ig-1" },
        ],
      };
      expect(hasPublishedTargets(post)).toBe(true);
    });

    it("should return true if target has platformPostId even if status is not PUBLISHED", () => {
      const post: PostWithTargetsSummary = {
        id: "p-4",
        status: "FAILED",
        targets: [{ platform: "TIKTOK", status: "FAILED", platformPostId: "tt-123" }],
      };
      expect(hasPublishedTargets(post)).toBe(true);
    });

    it("should return false if post is DRAFT/SCHEDULED with no published targets", () => {
      const post: PostWithTargetsSummary = {
        id: "p-5",
        status: "SCHEDULED",
        targets: [
          { platform: "META_PAGE", status: "SCHEDULED", platformPostId: null },
          { platform: "THREADS", status: "SCHEDULED" },
        ],
      };
      expect(hasPublishedTargets(post)).toBe(false);
    });
  });

  describe("getPublishedTargets", () => {
    it("should return empty array if post has no targets", () => {
      expect(getPublishedTargets(null)).toEqual([]);
      expect(getPublishedTargets({ id: "p-1", status: "DRAFT" })).toEqual([]);
    });

    it("should filter only published targets or targets with platformPostId", () => {
      const post: PostWithTargetsSummary = {
        id: "p-1",
        status: "PUBLISHED",
        targets: [
          { id: "t-1", platform: "META_PAGE", status: "PUBLISHED", platformPostId: "fb-1" },
          { id: "t-2", platform: "TIKTOK", status: "FAILED", platformPostId: null },
          { id: "t-3", platform: "THREADS", status: "PUBLISHED", platformPostId: "th-1" },
        ],
      };
      const result = getPublishedTargets(post);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.platform)).toEqual(["META_PAGE", "THREADS"]);
    });
  });

  describe("formatPlatformDisplayName", () => {
    it("should format known platforms correctly", () => {
      expect(formatPlatformDisplayName("META_PAGE")).toBe("Facebook Page");
      expect(formatPlatformDisplayName("INSTAGRAM")).toBe("Instagram");
      expect(formatPlatformDisplayName("TIKTOK")).toBe("TikTok");
      expect(formatPlatformDisplayName("THREADS")).toBe("Threads");
    });

    it("should fallback to raw platform string for unknown platforms", () => {
      expect(formatPlatformDisplayName("TWITTER")).toBe("TWITTER");
    });
  });

  describe("formatDeleteFeedbackMessage", () => {
    it("should return standard message if deleteOnPlatforms is false", () => {
      const res = formatDeleteFeedbackMessage({ deleteOnPlatforms: false });
      expect(res).toEqual({
        type: "success",
        message: "Postingan berhasil dihapus dari Mupost.",
      });
    });

    it("should return standard message if platformResults is empty", () => {
      const res = formatDeleteFeedbackMessage({ deleteOnPlatforms: true, platformResults: [] });
      expect(res).toEqual({
        type: "success",
        message: "Postingan berhasil dihapus dari Mupost.",
      });
    });

    it("should format message for successful external platform deletions", () => {
      const res = formatDeleteFeedbackMessage({
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
            platform: "INSTAGRAM",
            platformPostId: "ig-1",
            success: true,
          },
        ],
      });
      expect(res.type).toBe("success");
      expect(res.message).toContain("Postingan berhasil dihapus dari Mupost.");
      expect(res.message).toContain("Konten di Facebook Page, Instagram berhasil dihapus.");
    });

    it("should format message when content was already deleted on platform", () => {
      const res = formatDeleteFeedbackMessage({
        deleteOnPlatforms: true,
        platformResults: [
          {
            targetId: "t-1",
            platform: "THREADS",
            platformPostId: "th-1",
            success: true,
            alreadyDeleted: true,
          },
        ],
      });
      expect(res.type).toBe("success");
      expect(res.message).toContain("sudah dihapus sebelumnya");
    });

    it("should format message when platform deletion is unsupported", () => {
      const res = formatDeleteFeedbackMessage({
        deleteOnPlatforms: true,
        platformResults: [
          {
            targetId: "t-1",
            platform: "TIKTOK",
            platformPostId: "tt-1",
            success: false,
            unsupported: true,
          },
        ],
      });
      expect(res.type).toBe("success");
      expect(res.message).toContain("TikTok tidak mendukung penghapusan otomatis via API.");
    });

    it("should format info message with failure notice when a platform fails", () => {
      const res = formatDeleteFeedbackMessage({
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
            platform: "INSTAGRAM",
            platformPostId: "ig-1",
            success: false,
            errorCode: "TOKEN_EXPIRED",
          },
        ],
      });
      expect(res.type).toBe("info");
      expect(res.message).toContain("Gagal menghapus konten di Instagram.");
      expect(res.message).toContain("Konten di Facebook Page berhasil dihapus.");
    });
  });
});
