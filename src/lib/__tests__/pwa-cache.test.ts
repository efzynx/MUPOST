import { invalidatePostsCache, POSTS_CACHE_NAME } from "@/lib/pwa-cache";

describe("pwa-cache", () => {
  it("should return false gracefully if window is undefined (SSR environment)", async () => {
    const originalWindow = global.window;
    try {
      delete (global as Record<string, unknown>).window;
      const result = await invalidatePostsCache();
      expect(result).toBe(false);
    } finally {
      global.window = originalWindow;
    }
  });

  it("should invalidate api-posts-cache from CacheStorage", async () => {
    const originalWindow = global.window;
    const originalNavigator = global.navigator;

    const mockDelete = jest.fn().mockResolvedValue(true);
    const mockKeys = jest.fn().mockResolvedValue(["api-posts-cache", "other-cache"]);
    const mockPostCache = {
      keys: jest
        .fn()
        .mockResolvedValue([
          { url: "http://localhost:3000/api/posts" },
          { url: "http://localhost:3000/api/posts?page=1" },
        ]),
      delete: jest.fn().mockResolvedValue(true),
    };
    const mockOpen = jest.fn().mockResolvedValue(mockPostCache);

    try {
      (global as unknown as { window: unknown }).window = {
        location: { origin: "http://localhost:3000" },
        caches: {
          delete: mockDelete,
          keys: mockKeys,
          open: mockOpen,
        },
      };

      const result = await invalidatePostsCache();

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith(POSTS_CACHE_NAME);
      expect(mockPostCache.delete).toHaveBeenCalledTimes(2);
    } finally {
      global.window = originalWindow;
      global.navigator = originalNavigator;
    }
  });

  it("should postMessage to active Service Worker controller if available", async () => {
    const originalWindow = global.window;
    const originalNavigator = global.navigator;

    const mockPostMessage = jest.fn();

    try {
      (global as unknown as { window: unknown }).window = {
        location: { origin: "http://localhost:3000" },
        caches: {
          delete: jest.fn().mockResolvedValue(true),
          keys: jest.fn().mockResolvedValue([]),
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
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: "INVALIDATE_CACHE",
        cacheName: POSTS_CACHE_NAME,
      });
    } finally {
      global.window = originalWindow;
      global.navigator = originalNavigator;
    }
  });
});
