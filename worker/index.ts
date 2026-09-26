// Custom worker script for MUPOST

interface WorkerExtendableMessageEvent extends Event {
  data?: {
    type?: string;
    cacheName?: string;
  };
  waitUntil?: (promise: Promise<unknown>) => void;
}

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
});
