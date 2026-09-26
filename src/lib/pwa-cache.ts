/**
 * PWA Cache Invalidation Utility
 * Menangani invalidasi cache 'api-posts-cache' di Service Worker / browser CacheStorage.
 */

export const POSTS_CACHE_NAME = "api-posts-cache";

/**
 * Menghapus cache 'api-posts-cache' dari CacheStorage di browser,
 * dan mengirim sinyal invalidasi ke Service Worker jika aktif.
 */
export async function invalidatePostsCache(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  let invalidated = false;

  try {
    // 1. Hapus langsung via browser CacheStorage API jika didukung
    if ("caches" in window && typeof window.caches?.delete === "function") {
      const deleted = await window.caches.delete(POSTS_CACHE_NAME);
      if (deleted) {
        invalidated = true;
      }

      // Hapus juga URL matching /api/posts dari cache lain jika ada
      if (typeof window.caches.keys === "function") {
        const cacheNames = await window.caches.keys();
        for (const name of cacheNames) {
          if (name.includes("posts") || name === POSTS_CACHE_NAME) {
            try {
              const cache = await window.caches.open(name);
              const requests = await cache.keys();
              for (const request of requests) {
                const url = new URL(request.url, window.location.origin);
                if (url.pathname.startsWith("/api/posts")) {
                  await cache.delete(request);
                  invalidated = true;
                }
              }
            } catch {
              // Abaikan kegagalan cache individual
            }
          }
        }
      }
    }

    // 2. Beri tahu Service Worker aktif via postMessage
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "INVALIDATE_CACHE",
        cacheName: POSTS_CACHE_NAME,
      });
      invalidated = true;
    }
  } catch {
    // Abaikan error pada environment tanpa dukungan CacheStorage
  }

  return invalidated;
}
