"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PlatformType, PostStatus } from "@/lib/db/schema";

export interface TargetStatusSummary {
  id: string;
  platform: PlatformType;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  publishedAt?: Date | string | null;
}

export interface PostStatusEvent {
  type: "POST_STATUS_CHANGED" | "POST_CREATED" | "POST_DELETED";
  postId: string;
  userId: string;
  status: PostStatus;
  publishedAt?: Date | string | null;
  scheduledAt?: Date | string | null;
  targets?: TargetStatusSummary[];
  timestamp: string;
}

export interface StatusTransition {
  postId: string;
  textContent: string;
  oldStatus: string;
  newStatus: string;
  timestamp: number;
}

export interface PostRealtimeOptions {
  /**
   * Callback yang dipanggil saat ada pembaruan status post dari SSE atau polling.
   */
  onStatusChange?: (event: PostStatusEvent) => void;
  /**
   * Callback untuk rekonsiliasi data penuh (misal loadPosts atau loadStats).
   */
  onReconcile?: () => Promise<void> | void;
  /**
   * Apakah ada job aktif di antrean/sedang memproses.
   */
  hasActiveJobs?: boolean;
  /**
   * Apakah realtime aktif. Default: true.
   */
  enabled?: boolean;
  /**
   * Interval polling fallback saat ada job aktif (default: 3000ms).
   */
  activeInterval?: number;
  /**
   * Interval polling fallback saat idle (default: 15000ms).
   */
  idleInterval?: number;
  /**
   * Interval rekonsiliasi periodik saat SSE aktif (default: 30000ms).
   */
  sseReconcileInterval?: number;
  /**
   * Endpoint SSE stream (default: "/api/posts/stream").
   */
  streamUrl?: string;
  /**
   * Refresh otomatis saat window/tab kembali aktif (default: true).
   */
  refreshOnFocus?: boolean;
}

export type ConnectionMode = "sse" | "polling" | "paused" | "offline";

/**
 * Hook terpadu untuk Real-Time Status Update menggunakan SSE (Server-Sent Events)
 * dengan fallback otomatis ke Smart Dynamic Polling.
 */
export function usePostRealtime(options: PostRealtimeOptions = {}) {
  const {
    onStatusChange,
    onReconcile,
    hasActiveJobs = false,
    enabled = true,
    activeInterval = 3000,
    idleInterval = 15000,
    sseReconcileInterval = 30000,
    streamUrl = "/api/posts/stream",
    refreshOnFocus = true,
  } = options;

  const [isSseConnected, setIsSseConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("polling");

  // Keep references to avoid stale closures
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const onReconcileRef = useRef(onReconcile);
  onReconcileRef.current = onReconcile;

  const isMountedRef = useRef(true);
  const isExecutingRef = useRef(false);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatedRef = useRef<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Manual or automated full reconcile trigger
  const executeReconcile = useCallback(async () => {
    if (isExecutingRef.current) return;
    if (!onReconcileRef.current) return;

    isExecutingRef.current = true;
    if (isMountedRef.current) {
      setIsRefreshing(true);
    }

    try {
      await onReconcileRef.current();
      const now = new Date();
      lastUpdatedRef.current = now;
      if (isMountedRef.current) {
        setLastUpdated(now);
      }
    } catch {
      // Abaikan error jaringan saat background sync
    } finally {
      isExecutingRef.current = false;
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsSseConnected(false);
      setConnectionMode("paused");
      return;
    }

    let isTabVisible =
      typeof document !== "undefined" ? document.visibilityState !== "hidden" : true;
    let isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    // Helper untuk update status koneksi
    const updateMode = (sseActive: boolean) => {
      if (!isOnline) {
        setConnectionMode("offline");
      } else if (!isTabVisible) {
        setConnectionMode("paused");
      } else if (sseActive) {
        setConnectionMode("sse");
      } else {
        setConnectionMode("polling");
      }
    };

    // 1. Setup SSE Connection (jika browser mendukung)
    const setupEventSource = () => {
      if (typeof window === "undefined" || typeof EventSource === "undefined") {
        setIsSseConnected(false);
        updateMode(false);
        return;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      try {
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.addEventListener("connected", () => {
          if (!isMountedRef.current) return;
          setIsSseConnected(true);
          updateMode(true);
          const now = new Date();
          lastUpdatedRef.current = now;
          setLastUpdated(now);
        });

        es.addEventListener("post-status", (event: MessageEvent) => {
          if (!isMountedRef.current) return;
          try {
            const data: PostStatusEvent = JSON.parse(event.data);
            const now = new Date();
            lastUpdatedRef.current = now;
            setLastUpdated(now);
            onStatusChangeRef.current?.(data);
          } catch (parseErr) {
            // eslint-disable-next-line no-console
            console.warn("[usePostRealtime] Parse event failed:", parseErr);
          }
        });

        es.onerror = () => {
          if (!isMountedRef.current) return;
          setIsSseConnected(false);
          updateMode(false);
          // EventSource akan secara otomatis mencoba reconnect sesuai spesifikasi W3C
        };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[usePostRealtime] Failed to initialize SSE:", err);
        setIsSseConnected(false);
        updateMode(false);
      }
    };

    if (isOnline && isTabVisible) {
      setupEventSource();
    } else {
      updateMode(false);
    }

    // 2. Setup Dynamic Polling Fallback & Gentle Reconcile Timer
    const scheduleNextPoll = () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }

      if (!enabled || !isTabVisible || !isOnline) {
        return;
      }

      // Jika SSE tersambung, kita gunakan interval rekonsiliasi santai (30s)
      // Jika SSE terputus, kita gunakan polling dinamis: 3s saat ada job aktif, 15s saat idle
      const sseActive = !!(
        eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN
      );
      const interval = sseActive
        ? sseReconcileInterval
        : hasActiveJobs
          ? activeInterval
          : idleInterval;

      pollingTimerRef.current = setTimeout(async () => {
        await executeReconcile();
        scheduleNextPoll();
      }, interval);
    };

    scheduleNextPoll();

    // 3. Lifecycle event listeners
    const handleVisibilityChange = () => {
      const visible = document.visibilityState !== "hidden";
      isTabVisible = visible;
      updateMode(isSseConnected);

      if (visible && isOnline) {
        // Cek jika SSE terputus saat tab di latar belakang, buka kembali
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          setupEventSource();
        }

        // Langsung refresh data jika sudah lebih dari 4 detik
        const elapsed = lastUpdatedRef.current
          ? Date.now() - lastUpdatedRef.current.getTime()
          : Infinity;
        if (elapsed > 4000) {
          executeReconcile();
        }
        scheduleNextPoll();
      } else {
        if (pollingTimerRef.current) {
          clearTimeout(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
      }
    };

    const handleWindowFocus = () => {
      if (!refreshOnFocus || !isOnline || !isTabVisible) return;
      const elapsed = lastUpdatedRef.current
        ? Date.now() - lastUpdatedRef.current.getTime()
        : Infinity;
      if (elapsed > (hasActiveJobs ? activeInterval : 8000)) {
        executeReconcile();
        scheduleNextPoll();
      }
    };

    const handleOnline = () => {
      isOnline = true;
      setupEventSource();
      executeReconcile();
      scheduleNextPoll();
    };

    const handleOffline = () => {
      isOnline = false;
      setIsSseConnected(false);
      updateMode(false);
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      isMountedRef.current = false;
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [
    enabled,
    hasActiveJobs,
    activeInterval,
    idleInterval,
    sseReconcileInterval,
    streamUrl,
    refreshOnFocus,
    executeReconcile,
    isSseConnected,
  ]);

  const isLive =
    connectionMode === "sse" ||
    (connectionMode === "polling" && typeof navigator !== "undefined" && navigator.onLine);

  return {
    isLive,
    isSseConnected,
    isRefreshing,
    lastUpdated,
    connectionMode,
    refresh: executeReconcile,
  };
}

/**
 * Hook untuk mendeteksi dan melacak transisi status postingan real-time,
 * serta menyajikan daftar notifikasi toast yang otomatis hilang.
 */
export function useStatusTracker<T extends { id: string; status: string; textContent?: string }>(
  items: T[]
) {
  const previousStatusMap = useRef<Map<string, string>>(new Map());
  const [transitioningIds, setTransitioningIds] = useState<
    Map<string, { oldStatus: string; newStatus: string }>
  >(new Map());
  const [recentNotifications, setRecentNotifications] = useState<StatusTransition[]>([]);

  useEffect(() => {
    const prevMap = previousStatusMap.current;
    const nextMap = new Map<string, string>();
    const newTransitions = new Map<string, { oldStatus: string; newStatus: string }>();
    const notifications: StatusTransition[] = [];

    const isInitialLoad = prevMap.size === 0;

    for (const item of items) {
      nextMap.set(item.id, item.status);

      if (!isInitialLoad && prevMap.has(item.id)) {
        const oldStatus = prevMap.get(item.id)!;
        if (oldStatus !== item.status) {
          newTransitions.set(item.id, { oldStatus, newStatus: item.status });
          notifications.push({
            postId: item.id,
            textContent: item.textContent || "Postingan",
            oldStatus,
            newStatus: item.status,
            timestamp: Date.now(),
          });
        }
      }
    }

    previousStatusMap.current = nextMap;

    if (newTransitions.size > 0) {
      setTransitioningIds((prev) => {
        const merged = new Map(prev);
        newTransitions.forEach((data, id) => {
          merged.set(id, data);
        });
        return merged;
      });

      setRecentNotifications((prev) => [...notifications, ...prev].slice(0, 5));

      const timer = setTimeout(() => {
        setTransitioningIds((prev) => {
          const next = new Map(prev);
          newTransitions.forEach((_, id) => {
            next.delete(id);
          });
          return next;
        });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [items]);

  const dismissNotification = useCallback((postId: string) => {
    setRecentNotifications((prev) => prev.filter((n) => n.postId !== postId));
  }, []);

  return {
    transitioningIds,
    recentNotifications,
    dismissNotification,
  };
}
