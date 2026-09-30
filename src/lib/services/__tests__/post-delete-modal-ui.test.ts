import fs from "fs";
import path from "path";
import {
  hasPublishedTargets,
  formatDeleteFeedbackMessage,
  isPlatformDeleteSupported,
  getPlatformDeletePolicyNote,
} from "../post-delete-helpers";

describe("Frontend Post Deletion & Platform Sync Verification", () => {
  describe("1. Platform Capability & Policy Rules", () => {
    it("marks Facebook Page and Threads as supporting automated remote delete", () => {
      expect(isPlatformDeleteSupported("META_PAGE")).toBe(true);
      expect(isPlatformDeleteSupported("THREADS")).toBe(true);
    });

    it("marks Instagram and TikTok as requiring manual in-app deletion", () => {
      expect(isPlatformDeleteSupported("INSTAGRAM")).toBe(false);
      expect(isPlatformDeleteSupported("TIKTOK")).toBe(false);
      expect(isPlatformDeleteSupported("UNKNOWN_NETWORK")).toBe(false);
    });

    it("provides informative API policy notes for Instagram and TikTok", () => {
      const igNote = getPlatformDeletePolicyNote("INSTAGRAM");
      expect(igNote).not.toBeNull();
      expect(igNote).toContain("Instagram Graph API");
      expect(igNote).toContain("aplikasi Instagram");

      const ttNote = getPlatformDeletePolicyNote("TIKTOK");
      expect(ttNote).not.toBeNull();
      expect(ttNote).toContain("TikTok API");
      expect(ttNote).toContain("aplikasi TikTok");

      expect(getPlatformDeletePolicyNote("META_PAGE")).toBeNull();
      expect(getPlatformDeletePolicyNote("THREADS")).toBeNull();
    });
  });

  describe("2. Checkbox Default Selection Rules", () => {
    it("defaults to checked (true) when post status is PUBLISHED", () => {
      const post = {
        id: "post-pub-1",
        status: "PUBLISHED",
        targets: [],
      };
      expect(hasPublishedTargets(post)).toBe(true);
    });

    it("defaults to checked (true) when post has targets with PUBLISHED status or platformPostId", () => {
      const postWithTargetStatus = {
        id: "post-pub-2",
        status: "PARTIAL",
        targets: [
          {
            id: "t-1",
            platform: "META_PAGE",
            status: "PUBLISHED",
            platformPostId: "meta-123",
          },
        ],
      };
      expect(hasPublishedTargets(postWithTargetStatus)).toBe(true);

      const postWithPlatformPostIdOnly = {
        id: "post-pub-3",
        status: "DRAFT",
        targets: [
          {
            id: "t-2",
            platform: "THREADS",
            status: "DRAFT",
            platformPostId: "threads-456",
          },
        ],
      };
      expect(hasPublishedTargets(postWithPlatformPostIdOnly)).toBe(true);
    });

    it("defaults to unchecked (false) when post is DRAFT or SCHEDULED without published targets", () => {
      const draftPost = {
        id: "post-draft-1",
        status: "DRAFT",
        targets: [
          {
            id: "t-1",
            platform: "META_PAGE",
            status: "DRAFT",
            platformPostId: null,
          },
        ],
      };
      expect(hasPublishedTargets(draftPost)).toBe(false);

      const scheduledPost = {
        id: "post-sched-1",
        status: "SCHEDULED",
        targets: [
          {
            id: "t-2",
            platform: "INSTAGRAM",
            status: "PENDING",
            platformPostId: null,
          },
        ],
      };
      expect(hasPublishedTargets(scheduledPost)).toBe(false);
    });
  });

  describe("3. Feedback Detail & Platform Sync Messages", () => {
    it("formats success message detailing Mupost and Facebook Page deletion", () => {
      const feedback = formatDeleteFeedbackMessage({
        deleteOnPlatforms: true,
        platformResults: [
          {
            targetId: "t-1",
            platform: "META_PAGE",
            platformPostId: "fb-123",
            success: true,
          },
        ],
      });

      expect(feedback.type).toBe("success");
      expect(feedback.message).toContain("Postingan berhasil dihapus dari Mupost.");
      expect(feedback.message).toContain("Konten di Facebook Page berhasil dihapus.");
    });

    it("formats message with clear notice that Instagram/TikTok content must be removed from apps", () => {
      const feedback = formatDeleteFeedbackMessage({
        deleteOnPlatforms: true,
        platformResults: [
          {
            targetId: "t-1",
            platform: "INSTAGRAM",
            platformPostId: "ig-123",
            success: true,
            unsupported: true,
          },
          {
            targetId: "t-2",
            platform: "TIKTOK",
            platformPostId: "tt-123",
            success: true,
            unsupported: true,
          },
        ],
      });

      expect(feedback.type).toBe("success");
      expect(feedback.message).toContain("Postingan berhasil dihapus dari Mupost.");
      expect(feedback.message).toContain("tidak mendukung penghapusan otomatis via API.");
      expect(feedback.message).toContain("perlu dihapus langsung dari aplikasinya");
    });

    it("formats combined multi-platform summary for Facebook Page success and Instagram limitation", () => {
      const feedback = formatDeleteFeedbackMessage({
        deleteOnPlatforms: true,
        platformResults: [
          {
            targetId: "t-1",
            platform: "META_PAGE",
            platformPostId: "fb-123",
            success: true,
          },
          {
            targetId: "t-2",
            platform: "INSTAGRAM",
            platformPostId: "ig-123",
            success: true,
            unsupported: true,
          },
        ],
      });

      expect(feedback.type).toBe("success");
      expect(feedback.message).toContain("Konten di Facebook Page berhasil dihapus.");
      expect(feedback.message).toContain("Instagram tidak mendukung penghapusan otomatis via API.");
      expect(feedback.message).toContain("perlu dihapus langsung dari aplikasinya");
    });
  });

  describe("4. DeletePostModal UI Specifications & Accessibility", () => {
    const modalPath = path.resolve(__dirname, "../../../components/posts/delete-post-modal.tsx");
    const modalSource = fs.readFileSync(modalPath, "utf-8");

    it("contains touch targets meeting the >= 44px requirement", () => {
      // Buttons and clickable triggers should have min-h-[44px]
      const touchTargetMatches = modalSource.match(/min-h-\[44px\]/g);
      expect(touchTargetMatches).not.toBeNull();
      expect(touchTargetMatches!.length).toBeGreaterThanOrEqual(3);

      // Verify touch-manipulation is applied
      expect(modalSource).toContain("touch-manipulation");
    });

    it("supports consistent Dark and Light mode styling tokens", () => {
      // Verify light/dark theme classes are present
      expect(modalSource).toContain("dark:border-zinc-800");
      expect(modalSource).toContain("dark:bg-zinc-900");
      expect(modalSource).toContain("dark:text-zinc-100");
      expect(modalSource).toContain("bg-white");
    });

    it("does not contain intrusive sticky elements on mobile views", () => {
      // Modal should not use sticky header/footer that cuts off content
      expect(modalSource).not.toContain("sticky top-");
      expect(modalSource).not.toContain("sticky bottom-");
      expect(modalSource).toContain("max-h-[90vh]");
      expect(modalSource).toContain("overflow-y-auto");
    });

    it("renders capability badges for automated delete vs manual in-app delete", () => {
      expect(modalSource).toContain("Hapus Otomatis");
      expect(modalSource).toContain("Hapus Manual");
      expect(modalSource).toContain("isPlatformDeleteSupported");
      expect(modalSource).toContain("Catatan Kebijakan API");
    });
  });

  describe("5. Feedback Banner Integration in Posts and Edit Pages", () => {
    const postsPagePath = path.resolve(__dirname, "../../../app/(dashboard)/posts/page.tsx");
    const postsPageSource = fs.readFileSync(postsPagePath, "utf-8");

    const editPagePath = path.resolve(
      __dirname,
      "../../../app/(dashboard)/posts/[id]/edit/page.tsx"
    );
    const editPageSource = fs.readFileSync(editPagePath, "utf-8");

    it("implements cross-page feedback communication via sessionStorage flash key", () => {
      expect(postsPageSource).toContain("mupost_delete_feedback");
      expect(editPageSource).toContain("mupost_delete_feedback");
    });

    it("ensures feedback banner close buttons meet touch target standard", () => {
      expect(postsPageSource).toContain("min-h-[44px]");
      expect(editPageSource).toContain("min-h-[44px]");
      expect(postsPageSource).toContain('aria-label="Tutup notifikasi"');
      expect(editPageSource).toContain('aria-label="Tutup notifikasi"');
    });

    it("provides accessible status announcements with role and aria-live", () => {
      expect(postsPageSource).toContain('role="status"');
      expect(postsPageSource).toContain('aria-live="polite"');
      expect(editPageSource).toContain('role="status"');
      expect(editPageSource).toContain('aria-live="polite"');
    });

    it("supports info feedback type and dark/light color schemes on both pages", () => {
      expect(postsPageSource).toContain('feedback.type === "info"');
      expect(editPageSource).toContain('feedback.type === "info"');
      expect(postsPageSource).toContain("dark:bg-emerald-950/40");
      expect(editPageSource).toContain("dark:bg-emerald-950/40");
    });
  });
});
