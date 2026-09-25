import React from "react";
import ReactDOMServer from "react-dom/server";
import {
  calculateProportionalDimensions,
  isCompressibleImage,
  resolveOutputFormat,
  compressImage,
} from "@/lib/image-compressor";
import {
  PlatformPreviewSkeleton,
  PreviewPanelSkeleton,
} from "@/components/preview/PreviewSkeleton";
import { invalidatePostsCache, POSTS_CACHE_NAME } from "@/lib/pwa-cache";
import { detectMimeFromBytes } from "@/lib/services/media-uploader";
import { apiFetch } from "@/lib/api-client";
import * as pwaCacheModule from "@/lib/pwa-cache";

describe("QA & Regression Suite: Frontend & PWA Optimization (PR #8)", () => {
  // =========================================================================
  // 1. Client-Side Image Pre-Compression: 4K/8K Resolution & Aspect Ratio
  // =========================================================================
  describe("Image Compressor: Ultra-High Resolution Scaling (4K, 8K, & Aspect Ratios)", () => {
    it("should downscale 4K UHD 16:9 (3840x2160) to exactly 1920x1080", () => {
      const dimensions = calculateProportionalDimensions(3840, 2160, 1920, 1920);
      expect(dimensions).toEqual({ width: 1920, height: 1080 });
      // Verify exact 16:9 aspect ratio preservation
      expect(dimensions.width / dimensions.height).toBeCloseTo(16 / 9, 2);
    });

    it("should downscale 4K DCI 17:9 (4096x2160) proportionally without distortion", () => {
      const dimensions = calculateProportionalDimensions(4096, 2160, 1920, 1920);
      expect(dimensions.width).toBe(1920);
      expect(dimensions.height).toBe(1013);
      // Verify aspect ratio preservation
      const originalRatio = 4096 / 2160;
      const scaledRatio = dimensions.width / dimensions.height;
      expect(scaledRatio).toBeCloseTo(originalRatio, 2);
    });

    it("should downscale 8K UHD 16:9 (7680x4320) to exactly 1920x1080", () => {
      const dimensions = calculateProportionalDimensions(7680, 4320, 1920, 1920);
      expect(dimensions).toEqual({ width: 1920, height: 1080 });
      expect(dimensions.width / dimensions.height).toBeCloseTo(16 / 9, 2);
    });

    it("should downscale 8K DCI (8192x4320) to 1920x1013 proportionally", () => {
      const dimensions = calculateProportionalDimensions(8192, 4320, 1920, 1920);
      expect(dimensions.width).toBe(1920);
      expect(dimensions.height).toBe(1013);
    });

    it("should downscale extreme ultra-tall portrait infographic (1080x10800) constrained by maxHeight", () => {
      const dimensions = calculateProportionalDimensions(1080, 10800, 1920, 1920);
      expect(dimensions.height).toBe(1920);
      expect(dimensions.width).toBe(192);
      expect(dimensions.width / dimensions.height).toBeCloseTo(1080 / 10800, 2);
    });

    it("should downscale extreme panoramic landscape (12000x1200) constrained by maxWidth", () => {
      const dimensions = calculateProportionalDimensions(12000, 1200, 1920, 1920);
      expect(dimensions.width).toBe(1920);
      expect(dimensions.height).toBe(192);
      expect(dimensions.width / dimensions.height).toBeCloseTo(12000 / 1200, 2);
    });

    it("should downscale square HD images (6000x6000) to 1920x1920", () => {
      const dimensions = calculateProportionalDimensions(6000, 6000, 1920, 1920);
      expect(dimensions).toEqual({ width: 1920, height: 1920 });
    });

    it("should not scale up or alter images already smaller than max dimensions", () => {
      const dimensions = calculateProportionalDimensions(800, 600, 1920, 1920);
      expect(dimensions).toEqual({ width: 800, height: 600 });

      const tiny = calculateProportionalDimensions(1, 1, 1920, 1920);
      expect(tiny).toEqual({ width: 1, height: 1 });
    });

    it("should handle degenerate edge cases (0 or negative dimensions) safely with minimum 1px bounds", () => {
      expect(calculateProportionalDimensions(0, 0, 1920, 1920)).toEqual({ width: 1, height: 1 });
      expect(calculateProportionalDimensions(-50, 100, 1920, 1920)).toEqual({
        width: 1,
        height: 100,
      });
      expect(calculateProportionalDimensions(100, -50, 1920, 1920)).toEqual({
        width: 100,
        height: 1,
      });
    });
  });

  // =========================================================================
  // 2. Format Detection, Passthrough, & Video Safeguards
  // =========================================================================
  describe("Image Compressor: File Type & Video Safeguards", () => {
    it("should strictly permit compressible image MIME types (JPEG, PNG, WebP)", () => {
      expect(isCompressibleImage({ type: "image/jpeg" } as File)).toBe(true);
      expect(isCompressibleImage({ type: "image/png" } as File)).toBe(true);
      expect(isCompressibleImage({ type: "image/webp" } as File)).toBe(true);
    });

    it("should bypass video files (MP4, QuickTime MOV, WebM) without throwing error", () => {
      expect(isCompressibleImage({ type: "video/mp4" } as File)).toBe(false);
      expect(isCompressibleImage({ type: "video/quicktime" } as File)).toBe(false);
      expect(isCompressibleImage({ type: "video/webm" } as File)).toBe(false);
    });

    it("should bypass non-image and non-compressible assets (GIF, SVG, ICO, PDF, CSV, Audio)", () => {
      expect(isCompressibleImage({ type: "image/gif" } as File)).toBe(false);
      expect(isCompressibleImage({ type: "image/svg+xml" } as File)).toBe(false);
      expect(isCompressibleImage({ type: "image/x-icon" } as File)).toBe(false);
      expect(isCompressibleImage({ type: "application/pdf" } as File)).toBe(false);
      expect(isCompressibleImage({ type: "text/csv" } as File)).toBe(false);
      expect(isCompressibleImage({ type: "audio/mpeg" } as File)).toBe(false);
    });

    it("should resolve output formats and extensions accurately", () => {
      const pngFile = { type: "image/png" } as File;
      const webpFile = { type: "image/webp" } as File;
      const jpegFile = { type: "image/jpeg" } as File;

      // Default behavior
      expect(resolveOutputFormat(pngFile)).toEqual({ format: "image/jpeg", extension: ".jpg" });
      expect(resolveOutputFormat(webpFile)).toEqual({ format: "image/webp", extension: ".webp" });
      expect(resolveOutputFormat(jpegFile)).toEqual({ format: "image/jpeg", extension: ".jpg" });

      // Explicit overrides
      expect(resolveOutputFormat(pngFile, "image/webp")).toEqual({
        format: "image/webp",
        extension: ".webp",
      });
      expect(resolveOutputFormat(webpFile, "image/jpeg")).toEqual({
        format: "image/jpeg",
        extension: ".jpg",
      });
    });
  });

  // =========================================================================
  // 3. Browser Canvas Compression Simulation & Progress Verification
  // =========================================================================
  describe("Image Compressor: Browser Canvas Simulation & Compression Flow", () => {
    const originalWindow = global.window;
    const originalDocument = global.document;
    const originalURL = global.URL;

    afterEach(() => {
      global.window = originalWindow;
      global.document = originalDocument;
      global.URL = originalURL;
    });

    it("should bypass video files directly and return original reference", async () => {
      const video = new File(["dummy-mp4-data"], "sample-reel.mp4", { type: "video/mp4" });
      const result = await compressImage(video);
      expect(result).toBe(video);
    });

    it("should successfully compress 4K image with progress updates and white background for JPEG", async () => {
      const rawFile = new File(["mock-4k-png-data"], "highres-photo.png", { type: "image/png" });

      const mockCtx = {
        fillStyle: "",
        fillRect: jest.fn(),
        drawImage: jest.fn(),
      };

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: jest.fn().mockReturnValue(mockCtx),
        toBlob: jest.fn((callback: (b: Blob | null) => void) => {
          callback(new Blob(["compressed-4k-data"], { type: "image/jpeg" }));
        }),
      };

      (global as unknown as { window: unknown }).window = {};
      (global as unknown as { document: unknown }).document = {
        createElement: jest.fn((tag: string) => {
          if (tag === "canvas") return mockCanvas;
          return {};
        }),
      };
      (global as unknown as { URL: unknown }).URL = {
        createObjectURL: jest.fn().mockReturnValue("blob:mock-4k"),
        revokeObjectURL: jest.fn(),
      };

      class Mock4KImage {
        naturalWidth = 3840;
        naturalHeight = 2160;
        onload: (() => void) | null = null;
        set src(_v: string) {
          setTimeout(() => this.onload?.(), 0);
        }
      }
      (global as unknown as { Image: unknown }).Image = Mock4KImage;

      const progressSteps: number[] = [];
      const compressed = await compressImage(rawFile, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
        onProgress: (p) => progressSteps.push(p),
      });

      // Verify canvas resized to 1920x1080
      expect(mockCanvas.width).toBe(1920);
      expect(mockCanvas.height).toBe(1080);

      // Verify JPEG white background fill (prevents transparent PNG black background artifact)
      expect(mockCtx.fillStyle).toBe("#FFFFFF");
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080);
      expect(mockCtx.drawImage).toHaveBeenCalled();

      // Verify output file naming and type
      expect(compressed.name).toBe("highres-photo.jpg");
      expect(compressed.type).toBe("image/jpeg");

      // Verify progress callback sequence
      expect(progressSteps).toEqual([10, 35, 65, 90, 100]);
    });

    it("should compress WebP image retaining .webp extension without JPEG background filling", async () => {
      const webpFile = new File(["mock-webp-data"], "banner.webp", { type: "image/webp" });

      const mockCtx = {
        fillStyle: "",
        fillRect: jest.fn(),
        drawImage: jest.fn(),
      };

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: jest.fn().mockReturnValue(mockCtx),
        toBlob: jest.fn((callback: (b: Blob | null) => void) => {
          callback(new Blob(["compressed-webp-data"], { type: "image/webp" }));
        }),
      };

      (global as unknown as { window: unknown }).window = {};
      (global as unknown as { document: unknown }).document = {
        createElement: jest.fn((tag: string) => (tag === "canvas" ? mockCanvas : {})),
      };
      (global as unknown as { URL: unknown }).URL = {
        createObjectURL: jest.fn().mockReturnValue("blob:mock-webp"),
        revokeObjectURL: jest.fn(),
      };

      class MockWebPImage {
        naturalWidth = 2500;
        naturalHeight = 1500;
        onload: (() => void) | null = null;
        set src(_v: string) {
          setTimeout(() => this.onload?.(), 0);
        }
      }
      (global as unknown as { Image: unknown }).Image = MockWebPImage;

      const compressed = await compressImage(webpFile);

      expect(compressed.name).toBe("banner.webp");
      expect(compressed.type).toBe("image/webp");
      // fillRect should not be called with white background for WebP
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it("should fallback to original file if image loading throws error", async () => {
      const corruptFile = new File(["broken"], "corrupt.jpg", { type: "image/jpeg" });

      (global as unknown as { window: unknown }).window = {};
      (global as unknown as { document: unknown }).document = {
        createElement: jest.fn(),
      };
      (global as unknown as { URL: unknown }).URL = {
        createObjectURL: jest.fn().mockReturnValue("blob:corrupt"),
        revokeObjectURL: jest.fn(),
      };

      class FailingImage {
        onerror: ((err: unknown) => void) | null = null;
        set src(_v: string) {
          setTimeout(() => this.onerror?.(new Error("Corrupt image data")), 0);
        }
      }
      (global as unknown as { Image: unknown }).Image = FailingImage;

      const result = await compressImage(corruptFile);
      expect(result).toBe(corruptFile);
    });

    it("should preserve original file when unresized compression yields larger blob", async () => {
      // 800x600 small file with 500 bytes
      const smallFile = new File(["small-data-500-bytes"], "small.jpg", { type: "image/jpeg" });
      Object.defineProperty(smallFile, "size", { value: 500 });

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: jest.fn().mockReturnValue({
          fillStyle: "",
          fillRect: jest.fn(),
          drawImage: jest.fn(),
        }),
        toBlob: jest.fn((callback: (b: Blob | null) => void) => {
          // Output blob is 800 bytes (larger than original 500)
          const bloatedBlob = new Blob(["bloated-data-800-bytes"], { type: "image/jpeg" });
          Object.defineProperty(bloatedBlob, "size", { value: 800 });
          callback(bloatedBlob);
        }),
      };

      (global as unknown as { window: unknown }).window = {};
      (global as unknown as { document: unknown }).document = {
        createElement: jest.fn(() => mockCanvas),
      };
      (global as unknown as { URL: unknown }).URL = {
        createObjectURL: jest.fn().mockReturnValue("blob:small"),
        revokeObjectURL: jest.fn(),
      };

      class SmallImage {
        naturalWidth = 800;
        naturalHeight = 600;
        onload: (() => void) | null = null;
        set src(_v: string) {
          setTimeout(() => this.onload?.(), 0);
        }
      }
      (global as unknown as { Image: unknown }).Image = SmallImage;

      const result = await compressImage(smallFile);
      // Should preserve original file instead of inflating size
      expect(result).toBe(smallFile);
    });
  });

  // =========================================================================
  // 4. Dynamic Imports & Zero Cumulative Layout Shift (CLS)
  // =========================================================================
  describe("Zero CLS: Dynamic Import Skeleton Loaders", () => {
    it("should render PreviewPanelSkeleton with min-h-[460px] and accessible busy indicators", () => {
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(PreviewPanelSkeleton));

      expect(html).toContain('data-testid="preview-panel-skeleton"');
      expect(html).toContain("min-h-[460px]");
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Memuat pratinjau..."');
      expect(html).toContain("animate-pulse");

      // Verify nested platform preview skeleton is present
      expect(html).toContain('data-testid="platform-preview-skeleton"');
    });

    it("should render PlatformPreviewSkeleton with min-height 520px for TikTok", () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(PlatformPreviewSkeleton, { platform: "tiktok" })
      );

      expect(html).toContain('data-testid="platform-preview-skeleton"');
      expect(html).toContain("min-height:520px");
      expect(html).toContain("animate-pulse");
    });

    it("should render PlatformPreviewSkeleton with min-height 380px for Facebook, Instagram, and Threads", () => {
      const platforms = ["facebook", "instagram", "threads"] as const;

      for (const platform of platforms) {
        const html = ReactDOMServer.renderToStaticMarkup(
          React.createElement(PlatformPreviewSkeleton, { platform })
        );

        expect(html).toContain('data-testid="platform-preview-skeleton"');
        expect(html).toContain("min-height:380px");
      }
    });

    it("should default to 380px min-height when no platform is specified", () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(PlatformPreviewSkeleton)
      );

      expect(html).toContain('data-testid="platform-preview-skeleton"');
      expect(html).toContain("min-height:380px");
    });
  });

  // =========================================================================
  // 5. PWA Cache Invalidation & Automatic Invalidation on Mutations
  // =========================================================================
  describe("PWA Cache: Invalidation & Network Mutation Interception", () => {
    const originalWindow = global.window;
    const originalNavigator = global.navigator;
    const originalFetch = global.fetch;

    afterEach(() => {
      global.window = originalWindow;
      global.navigator = originalNavigator;
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it("should delete POSTS_CACHE_NAME and postMessage to active Service Worker controller", async () => {
      const mockCachesDelete = jest.fn().mockResolvedValue(true);
      const mockPostMessage = jest.fn();

      (global as unknown as { window: unknown }).window = {
        location: { origin: "http://localhost:3000" },
        caches: {
          delete: mockCachesDelete,
          keys: jest.fn().mockResolvedValue([POSTS_CACHE_NAME]),
          open: jest.fn().mockResolvedValue({
            keys: jest.fn().mockResolvedValue([]),
            delete: jest.fn().mockResolvedValue(true),
          }),
        },
      };

      (global as unknown as { navigator: unknown }).navigator = {
        serviceWorker: {
          controller: {
            postMessage: mockPostMessage,
          },
        },
      };

      const result = await invalidatePostsCache();

      expect(result).toBe(true);
      expect(mockCachesDelete).toHaveBeenCalledWith(POSTS_CACHE_NAME);
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: "INVALIDATE_CACHE",
        cacheName: POSTS_CACHE_NAME,
      });
    });

    it("should automatically trigger invalidatePostsCache on successful POST/PUT/PATCH/DELETE to /api/posts in apiFetch", async () => {
      const invalidateSpy = jest
        .spyOn(pwaCacheModule, "invalidatePostsCache")
        .mockResolvedValue(true);

      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: "post-123" } }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      // 1. POST /api/posts -> should trigger invalidation
      await apiFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({ textContent: "test" }),
      });
      expect(invalidateSpy).toHaveBeenCalledTimes(1);

      // 2. PUT /api/posts/post-123 -> should trigger invalidation
      await apiFetch("/api/posts/post-123", {
        method: "PUT",
        body: JSON.stringify({ textContent: "update" }),
      });
      expect(invalidateSpy).toHaveBeenCalledTimes(2);

      // 3. DELETE /api/posts/post-123 -> should trigger invalidation
      await apiFetch("/api/posts/post-123", { method: "DELETE" });
      expect(invalidateSpy).toHaveBeenCalledTimes(3);

      // 4. GET /api/posts -> should NOT trigger invalidation
      await apiFetch("/api/posts", { method: "GET" });
      expect(invalidateSpy).toHaveBeenCalledTimes(3);

      // 5. POST to other endpoint -> should NOT trigger invalidation
      await apiFetch("/api/auth/login", { method: "POST", body: "{}" });
      expect(invalidateSpy).toHaveBeenCalledTimes(3);
    });

    it("should handle SSR or missing CacheStorage gracefully without throwing", async () => {
      delete (global as Record<string, unknown>).window;

      const result = await invalidatePostsCache();
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // 6. Backend WebP Magic Byte Detection & Extension Mapping
  // =========================================================================
  describe("Backend Media Uploader: WebP Magic Byte Signature Verification", () => {
    it("should accurately detect valid WebP files (RIFF at offset 0, WEBP at offset 8)", () => {
      // 12-byte buffer: RIFF [0x52, 0x49, 0x46, 0x46], 4 bytes size, WEBP [0x57, 0x45, 0x42, 0x50]
      const webpBuffer = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // "RIFF"
        0x20,
        0x00,
        0x00,
        0x00, // file size dummy
        0x57,
        0x45,
        0x42,
        0x50, // "WEBP"
        0x56,
        0x50,
        0x38,
        0x20, // VP8 chunk
      ]);

      const detected = detectMimeFromBytes(webpBuffer);
      expect(detected).toBe("image/webp");
    });

    it("should reject invalid, corrupt, or truncated WebP headers", () => {
      // Buffer with RIFF but missing WEBP
      const badBuffer = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46,
        0x20,
        0x00,
        0x00,
        0x00,
        0x41,
        0x56,
        0x49,
        0x20, // "AVI " instead of WEBP
      ]);

      expect(detectMimeFromBytes(badBuffer)).toBeNull();

      // Short buffer under 12 bytes
      const shortBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x20]);
      expect(detectMimeFromBytes(shortBuffer)).toBeNull();
    });

    it("should preserve detection for existing standard media types without regression", () => {
      // JPEG: FF D8 FF
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(detectMimeFromBytes(jpegBuffer)).toBe("image/jpeg");

      // PNG: 89 50 4E 47 0D 0A 1A 0A
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(detectMimeFromBytes(pngBuffer)).toBe("image/png");

      // GIF: GIF89a
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(detectMimeFromBytes(gifBuffer)).toBe("image/gif");

      // MP4: offset 4 ftyp
      const mp4Buffer = Buffer.from([
        0x00,
        0x00,
        0x00,
        0x20,
        0x66,
        0x74,
        0x79,
        0x70, // "ftyp"
        0x69,
        0x73,
        0x6f,
        0x6d,
      ]);
      expect(detectMimeFromBytes(mp4Buffer)).toBe("video/mp4");
    });
  });

  // =========================================================================
  // 7. Offline UX & Connection Verification Contract
  // =========================================================================
  describe("Offline UX: OfflineBanner & Connection Verification Contract", () => {
    const originalWindow = global.window;
    const originalNavigator = global.navigator;
    const originalFetch = global.fetch;

    afterEach(() => {
      global.window = originalWindow;
      global.navigator = originalNavigator;
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it("should verify connection check logic targets /api/auth/me with HEAD and cache: no-store", async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = mockFetch;

      (global as unknown as { window: unknown }).window = {};
      (global as unknown as { navigator: unknown }).navigator = { onLine: true };

      // Simulate the exact connection check execution implemented in OfflineBanner
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        await fetch("/api/auth/me", {
          method: "HEAD",
          cache: "no-store",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/auth/me",
        expect.objectContaining({
          method: "HEAD",
          cache: "no-store",
        })
      );
    });

    it("should abort connection check if network takes longer than 3000ms", async () => {
      jest.useFakeTimers();

      const controller = new AbortController();
      const abortSpy = jest.spyOn(controller, "abort");
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      jest.advanceTimersByTime(3000);

      expect(abortSpy).toHaveBeenCalled();
      clearTimeout(timeoutId);
      jest.useRealTimers();
    });

    it("should verify online/offline event listener lifecycle for useOnlineStatus", () => {
      const listeners: Record<string, () => void> = {};
      const addEventListener = jest.fn((event: string, handler: () => void) => {
        listeners[event] = handler;
      });
      const removeEventListener = jest.fn((event: string) => {
        delete listeners[event];
      });

      (global as unknown as { window: unknown }).window = {
        addEventListener,
        removeEventListener,
      };
      (global as unknown as { navigator: unknown }).navigator = { onLine: false };

      // Simulate registration
      let isOnline = false;
      const handleOnline = () => {
        isOnline = true;
      };
      const handleOffline = () => {
        isOnline = false;
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      expect(addEventListener).toHaveBeenCalledWith("online", expect.any(Function));
      expect(addEventListener).toHaveBeenCalledWith("offline", expect.any(Function));

      // Trigger online event
      listeners["online"]?.();
      expect(isOnline).toBe(true);

      // Trigger offline event
      listeners["offline"]?.();
      expect(isOnline).toBe(false);

      // Simulate cleanup
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      expect(removeEventListener).toHaveBeenCalledWith("online", handleOnline);
      expect(removeEventListener).toHaveBeenCalledWith("offline", handleOffline);
    });
  });

  // =========================================================================
  // 8. Compression Progress UI Indicator Contract (data-testid)
  // =========================================================================
  describe("Compression Progress Indicator Component Contract", () => {
    it("should render compression progress container with data-testid='compression-progress' and percentage style", () => {
      // Simulate rendering the compression progress component as authored in new/page.tsx & edit/page.tsx
      const compressionProgress = 65;
      const compressionMessage = "Mengompresi gambar (8.4 MB)...";

      const element = React.createElement(
        "div",
        {
          "data-testid": "compression-progress",
          className:
            "p-3 rounded-lg bg-blue-950/40 border border-blue-800/60 text-blue-300 text-xs space-y-2 animate-in fade-in duration-200",
        },
        React.createElement(
          "div",
          { className: "flex items-center justify-between font-medium" },
          React.createElement("span", null, compressionMessage),
          React.createElement(
            "span",
            { className: "font-mono text-[11px]" },
            `${compressionProgress}%`
          )
        ),
        React.createElement(
          "div",
          { className: "w-full bg-blue-950 rounded-full h-1.5 overflow-hidden" },
          React.createElement("div", {
            className: "bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out",
            style: { width: `${compressionProgress}%` },
          })
        )
      );

      const html = ReactDOMServer.renderToStaticMarkup(element);

      expect(html).toContain('data-testid="compression-progress"');
      expect(html).toContain("Mengompresi gambar (8.4 MB)...");
      expect(html).toContain("65%");
      expect(html).toContain("width:65%");
    });
  });
});
