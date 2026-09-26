// Custom worker script for MUPOST

interface WorkerExtendableMessageEvent extends Event {
  data?: {
    type?: string;
    cacheName?: string;
  };
  waitUntil?: (promise: Promise<unknown>) => void;
}

interface WorkerSyncEvent extends Event {
  tag?: string;
  waitUntil?: (promise: Promise<unknown>) => void;
}

// Invalidation & sync message handler
addEventListener("message", (event: Event) => {
  const msgEvent = event as WorkerExtendableMessageEvent;
  if (msgEvent.data && msgEvent.data.type === "INVALIDATE_CACHE") {
    const cacheName = msgEvent.data.cacheName || "api-posts-cache";
    if (typeof caches !== "undefined") {
      const deletePromise = caches.delete(cacheName);
      if (typeof msgEvent.waitUntil === "function") {
        msgEvent.waitUntil(deletePromise);
      }
    }
  }

  if (msgEvent.data && msgEvent.data.type === "TRIGGER_SYNC") {
    // Notify all window clients to run offline sync
    // @ts-expect-error - self is ServiceWorkerGlobalScope
    if (typeof self !== "undefined" && self.clients) {
      // @ts-expect-error - self is ServiceWorkerGlobalScope
      const syncPromise = self.clients
        .matchAll({ type: "window" })
        .then((clients: Array<{ postMessage: (msg: unknown) => void }>) => {
          clients.forEach((c) => c.postMessage({ type: "SYNC_OFFLINE_DRAFTS" }));
        });
      if (typeof msgEvent.waitUntil === "function") {
        msgEvent.waitUntil(syncPromise);
      }
    }
  }
});

// Background Sync API (Chrome / Edge / Android PWA)
addEventListener("sync", (event: Event) => {
  const syncEvent = event as WorkerSyncEvent;
  if (syncEvent.tag === "sync-offline-drafts") {
    // @ts-expect-error - self is ServiceWorkerGlobalScope
    if (typeof self !== "undefined" && self.clients) {
      // @ts-expect-error - self is ServiceWorkerGlobalScope
      const p = self.clients
        .matchAll({ type: "window" })
        .then((clients: Array<{ postMessage: (msg: unknown) => void }>) => {
          clients.forEach((c) => c.postMessage({ type: "SYNC_OFFLINE_DRAFTS" }));
        });
      if (typeof syncEvent.waitUntil === "function") {
        syncEvent.waitUntil(p);
      }
    }
  }
});
