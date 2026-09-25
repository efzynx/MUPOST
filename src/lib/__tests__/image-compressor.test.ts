import {
  calculateProportionalDimensions,
  isCompressibleImage,
  resolveOutputFormat,
  compressImage,
} from "@/lib/image-compressor";

describe("image-compressor", () => {
  describe("calculateProportionalDimensions", () => {
    it("should keep dimensions unchanged if already within maxWidth and maxHeight", () => {
      const result = calculateProportionalDimensions(1280, 720, 1920, 1920);
      expect(result).toEqual({ width: 1280, height: 720 });
    });

    it("should scale down landscape image proportionally when width exceeds maxWidth", () => {
      // 3840x2160 scaled to max 1920x1920 -> 1920x1080
      const result = calculateProportionalDimensions(3840, 2160, 1920, 1920);
      expect(result).toEqual({ width: 1920, height: 1080 });
    });

    it("should scale down portrait image proportionally when height exceeds maxHeight", () => {
      // 1080x2400 scaled to max 1920x1920 -> 864x1920
      const result = calculateProportionalDimensions(1080, 2400, 1920, 1920);
      expect(result).toEqual({ width: 864, height: 1920 });
    });

    it("should handle square image exceeding dimensions", () => {
      const result = calculateProportionalDimensions(3000, 3000, 1920, 1920);
      expect(result).toEqual({ width: 1920, height: 1920 });
    });

    it("should handle invalid or zero dimensions without division by zero errors", () => {
      const resultZero = calculateProportionalDimensions(0, 0, 1920, 1920);
      expect(resultZero.width).toBeGreaterThanOrEqual(1);
      expect(resultZero.height).toBeGreaterThanOrEqual(1);
    });
  });

  describe("isCompressibleImage", () => {
    it("should return true for supported image MIME types", () => {
      const jpegFile = { type: "image/jpeg" } as File;
      const pngFile = { type: "image/png" } as File;
      const webpFile = { type: "image/webp" } as File;

      expect(isCompressibleImage(jpegFile)).toBe(true);
      expect(isCompressibleImage(pngFile)).toBe(true);
      expect(isCompressibleImage(webpFile)).toBe(true);
    });

    it("should return false for video files", () => {
      const mp4File = { type: "video/mp4" } as File;
      const movFile = { type: "video/quicktime" } as File;

      expect(isCompressibleImage(mp4File)).toBe(false);
      expect(isCompressibleImage(movFile)).toBe(false);
    });

    it("should return false for GIF animation or SVG", () => {
      const gifFile = { type: "image/gif" } as File;
      const svgFile = { type: "image/svg+xml" } as File;

      expect(isCompressibleImage(gifFile)).toBe(false);
      expect(isCompressibleImage(svgFile)).toBe(false);
    });

    it("should return false for invalid files or non-image types", () => {
      expect(isCompressibleImage({ type: "application/pdf" } as File)).toBe(false);
      expect(isCompressibleImage(null as unknown as File)).toBe(false);
    });
  });

  describe("resolveOutputFormat", () => {
    it("should honor explicitly requested format", () => {
      const file = { type: "image/png" } as File;
      const webpResult = resolveOutputFormat(file, "image/webp");
      expect(webpResult).toEqual({ format: "image/webp", extension: ".webp" });

      const jpegResult = resolveOutputFormat(file, "image/jpeg");
      expect(jpegResult).toEqual({ format: "image/jpeg", extension: ".jpg" });
    });

    it("should preserve WebP format if original file is WebP and no format specified", () => {
      const file = { type: "image/webp" } as File;
      const result = resolveOutputFormat(file);
      expect(result).toEqual({ format: "image/webp", extension: ".webp" });
    });

    it("should default to JPEG for other formats when no format specified", () => {
      const file = { type: "image/png" } as File;
      const result = resolveOutputFormat(file);
      expect(result).toEqual({ format: "image/jpeg", extension: ".jpg" });
    });
  });

  describe("compressImage", () => {
    it("should pass through video file untouched without error", async () => {
      const videoFile = {
        name: "test-video.mp4",
        type: "video/mp4",
        size: 15 * 1024 * 1024,
      } as unknown as File;

      const result = await compressImage(videoFile);
      expect(result).toBe(videoFile);
    });

    it("should pass through GIF file untouched without error", async () => {
      const gifFile = {
        name: "animation.gif",
        type: "image/gif",
        size: 2 * 1024 * 1024,
      } as unknown as File;

      const result = await compressImage(gifFile);
      expect(result).toBe(gifFile);
    });

    it("should return original file if not running in browser environment (SSR fallback)", async () => {
      const imgFile = {
        name: "photo.jpg",
        type: "image/jpeg",
        size: 5 * 1024 * 1024,
      } as unknown as File;

      // In Node environment, window/document is undefined
      const result = await compressImage(imgFile);
      expect(result).toBe(imgFile);
    });

    it("should execute browser canvas flow when window/document are present", async () => {
      const originalFile = new File(["dummy-content"], "sample-photo.png", {
        type: "image/png",
      });

      // Mock browser globals
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: jest.fn().mockReturnValue({
          fillStyle: "",
          fillRect: jest.fn(),
          drawImage: jest.fn(),
        }),
        toBlob: jest.fn((callback: (blob: Blob | null) => void) => {
          const fakeBlob = new Blob(["compressed-content"], { type: "image/jpeg" });
          callback(fakeBlob);
        }),
      };

      const originalWindow = global.window;
      const originalDocument = global.document;
      const originalURL = global.URL;

      try {
        (global as unknown as { window: unknown }).window = {};
        (global as unknown as { document: unknown }).document = {
          createElement: jest.fn().mockImplementation((tag: string) => {
            if (tag === "canvas") return mockCanvas;
            return {};
          }),
        };
        (global as unknown as { URL: unknown }).URL = {
          createObjectURL: jest.fn().mockReturnValue("blob:mock-url"),
          revokeObjectURL: jest.fn(),
        };

        // Mock Image class
        class MockImage {
          naturalWidth = 2400;
          naturalHeight = 1600;
          width = 2400;
          height = 1600;
          onload: (() => void) | null = null;
          onerror: ((err: unknown) => void) | null = null;
          set src(_val: string) {
            setTimeout(() => {
              if (this.onload) this.onload();
            }, 0);
          }
        }
        (global as unknown as { Image: unknown }).Image = MockImage;

        const progressUpdates: number[] = [];
        const compressed = await compressImage(originalFile, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
          onProgress: (p) => progressUpdates.push(p),
        });

        expect(compressed.name).toBe("sample-photo.jpg");
        expect(compressed.type).toBe("image/jpeg");
        expect(mockCanvas.width).toBe(1920);
        expect(mockCanvas.height).toBe(1280);
        expect(progressUpdates).toContain(100);
      } finally {
        global.window = originalWindow;
        global.document = originalDocument;
        global.URL = originalURL;
      }
    });

    it("should gracefully return original file when canvas fails", async () => {
      const originalFile = new File(["dummy-content"], "corrupt.png", {
        type: "image/png",
      });

      const originalWindow = global.window;
      const originalDocument = global.document;

      try {
        (global as unknown as { window: unknown }).window = {};
        (global as unknown as { document: unknown }).document = {
          createElement: jest.fn().mockImplementation(() => {
            throw new Error("Canvas context unavailable");
          }),
        };

        const result = await compressImage(originalFile);
        expect(result).toBe(originalFile);
      } finally {
        global.window = originalWindow;
        global.document = originalDocument;
      }
    });
  });
});
