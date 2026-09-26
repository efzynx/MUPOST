import {
  PLATFORM_SPECS,
  validatePlatformConstraints,
  validateMultiPlatformConstraints,
  isVideoUrl,
} from "@/lib/platform-constraints";

describe("Platform Constraint Validator", () => {
  describe("Platform Specifications", () => {
    it("has correct limits for all 4 supported platforms", () => {
      expect(PLATFORM_SPECS.THREADS.maxCharacters).toBe(500);
      expect(PLATFORM_SPECS.TIKTOK.maxCharacters).toBe(2200);
      expect(PLATFORM_SPECS.INSTAGRAM.maxCharacters).toBe(2200);
      expect(PLATFORM_SPECS.META_PAGE.maxCharacters).toBe(63206);
    });

    it("enforces media requirements correctly per platform", () => {
      expect(PLATFORM_SPECS.TIKTOK.requiresMedia).toBe(true);
      expect(PLATFORM_SPECS.TIKTOK.mediaTypeAllowed).toBe("video_only");

      expect(PLATFORM_SPECS.INSTAGRAM.requiresMedia).toBe(true);
      expect(PLATFORM_SPECS.INSTAGRAM.mediaTypeAllowed).toBe("all");

      expect(PLATFORM_SPECS.THREADS.requiresMedia).toBe(false);
      expect(PLATFORM_SPECS.META_PAGE.requiresMedia).toBe(false);
    });
  });

  describe("isVideoUrl helper", () => {
    it("identifies video extensions accurately", () => {
      expect(isVideoUrl("https://example.com/video.mp4")).toBe(true);
      expect(isVideoUrl("https://example.com/video.mov")).toBe(true);
      expect(isVideoUrl("https://example.com/video.webm")).toBe(true);
      expect(isVideoUrl("https://example.com/video.MP4?token=123")).toBe(true);

      expect(isVideoUrl("https://example.com/image.jpg")).toBe(false);
      expect(isVideoUrl("https://example.com/photo.png")).toBe(false);
      expect(isVideoUrl("https://example.com/anim.gif")).toBe(false);
      expect(isVideoUrl("")).toBe(false);
    });
  });

  describe("Threads constraint validation", () => {
    it("accepts text under 500 characters", () => {
      const result = validatePlatformConstraints("THREADS", "Halo Threads!");
      expect(result.isValid).toBe(true);
      expect(result.charStatus).toBe("safe");
      expect(result.remainingChars).toBe(500 - "Halo Threads!".length);
      expect(result.errors).toHaveLength(0);
    });

    it("triggers warning when approaching 500 characters", () => {
      const text460 = "a".repeat(460); // 92% > 85%
      const result = validatePlatformConstraints("THREADS", text460);
      expect(result.isValid).toBe(true);
      expect(result.charStatus).toBe("warning");
      expect(result.remainingChars).toBe(40);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("rejects text exceeding 500 characters", () => {
      const text505 = "a".repeat(505);
      const result = validatePlatformConstraints("THREADS", text505);
      expect(result.isValid).toBe(false);
      expect(result.charStatus).toBe("exceeded");
      expect(result.remainingChars).toBe(-5);
      expect(result.errors[0]).toContain("Melebihi batas karakter Threads");
    });

    it("validates max media count (10 items)", () => {
      const elevenImages = Array.from({ length: 11 }, (_, i) => `https://example.com/img${i}.jpg`);
      const result = validatePlatformConstraints(
        "THREADS",
        "Threads with too many media",
        elevenImages
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("melebihi batas maksimal"))).toBe(true);
    });
  });

  describe("TikTok constraint validation", () => {
    it("flags error if video media is missing", () => {
      const result = validatePlatformConstraints("TIKTOK", "TikTok caption", []);
      expect(result.isValid).toBe(false);
      expect(result.mediaStatus).toBe("error");
      expect(result.errors.some((e) => e.includes("video"))).toBe(true);
    });

    it("flags error if only image is provided when video is required", () => {
      const result = validatePlatformConstraints("TIKTOK", "TikTok caption", [
        "https://example.com/photo.jpg",
      ]);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("hanya mendukung media video"))).toBe(true);
    });

    it("passes when valid video is provided within 2200 characters", () => {
      const result = validatePlatformConstraints("TIKTOK", "TikTok caption seru!", [
        "https://example.com/dance.mp4",
      ]);
      expect(result.isValid).toBe(true);
      expect(result.charStatus).toBe("safe");
      expect(result.hasVideo).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("fails when text exceeds 2200 characters", () => {
      const longText = "a".repeat(2201);
      const result = validatePlatformConstraints("TIKTOK", longText, [
        "https://example.com/dance.mp4",
      ]);
      expect(result.isValid).toBe(false);
      expect(result.charStatus).toBe("exceeded");
    });
  });

  describe("Instagram constraint validation", () => {
    it("requires at least 1 image or video (fails on text-only)", () => {
      const result = validatePlatformConstraints("INSTAGRAM", "Post tanpa gambar", []);
      expect(result.isValid).toBe(false);
      expect(result.mediaStatus).toBe("error");
      expect(result.errors[0]).toContain("Instagram memerlukan minimal 1 gambar atau video");
    });

    it("passes with image within 2200 characters", () => {
      const result = validatePlatformConstraints("INSTAGRAM", "Foto liburan", [
        "https://example.com/holiday.jpg",
      ]);
      expect(result.isValid).toBe(true);
      expect(result.charStatus).toBe("safe");
      expect(result.errors).toHaveLength(0);
    });

    it("enforces carousel maximum 10 items", () => {
      const twelveImages = Array.from({ length: 12 }, (_, i) => `https://example.com/pic${i}.jpg`);
      const result = validatePlatformConstraints("INSTAGRAM", "Banyak foto", twelveImages);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("melebihi batas maksimal"))).toBe(true);
    });
  });

  describe("Facebook constraint validation", () => {
    it("accepts text-only posts up to 63,206 characters", () => {
      const result = validatePlatformConstraints("META_PAGE", "Status Facebook seru", []);
      expect(result.isValid).toBe(true);
      expect(result.maxCharacters).toBe(63206);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Multi-platform validation aggregation", () => {
    it("correctly identifies strictest limit when Threads is included", () => {
      const summary = validateMultiPlatformConstraints(
        ["META_PAGE", "INSTAGRAM", "THREADS"],
        "Hello multi-platform world!"
      );
      expect(summary.strictestCharLimit?.platform).toBe("THREADS");
      expect(summary.strictestCharLimit?.maxCharacters).toBe(500);
    });

    it("reports blocking errors when one platform violates constraints", () => {
      // Instagram requires media, but empty media passed
      const summary = validateMultiPlatformConstraints(
        ["THREADS", "INSTAGRAM"],
        "Pendek di bawah 500 chars",
        []
      );
      expect(summary.allValid).toBe(false);
      expect(summary.hasBlockingErrors).toBe(true);
      expect(summary.blockingReasons.some((r) => r.includes("Instagram memerlukan"))).toBe(true);
    });

    it("succeeds when all selected platforms criteria are met", () => {
      const summary = validateMultiPlatformConstraints(
        ["THREADS", "INSTAGRAM", "TIKTOK"],
        "Konten valid dengan video",
        ["https://example.com/clip.mp4"]
      );
      expect(summary.allValid).toBe(true);
      expect(summary.hasBlockingErrors).toBe(false);
      expect(summary.blockingReasons).toHaveLength(0);
    });
  });
});
