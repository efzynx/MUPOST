"use client";

import { useEffect, useRef, useState, useCallback } from "react";
export {
  usePostRealtime,
  useStatusTracker,
  type PostStatusEvent,
  type PostRealtimeOptions,
  type StatusTransition,
  type ConnectionMode,
} from "./use-post-realtime";

export interface SmartPollingOptions {
  /**
   * Interval polling saat ada job aktif (dalam antrean/proses), default: 3000ms.
   */
  activeInterval?: number;
  /**
   * Interval polling santai saat tidak ada job aktif, default: 15000ms.
   */
  idleInterval?: number;
  /**
   * Apakah fitur polling diaktifkan, default: true.
   */
  enabled?: boolean;
  /**
   * Jalankan fetch saat window kembali fokus / online, default: true.
   */
  refreshOnFocus?: boolean;
}

export function useSmartPolling(
  callback: () => Promise<void> | void,
  hasActiveJobs: boolean,
  options: SmartPollingOptions = {}
) {
  const {
    activeInterval = 3000,
    idleInterval = 15000,
    enabled = true,
    refreshOnFocus = true,
  } = options;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(true);

  // References to avoid stale closures
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const isMountedRef = useRef(true);
  const isExecutingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatedRef = useRef<Date | null>(null);

  const executeRefresh = useCallback(async () => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    if (isMountedRef.current) {
      setIsRefreshing(true);
    }

    try {
      await callbackRef.current();
      const now = new Date();
      lastUpdatedRef.current = now;
      if (isMountedRef.current) {
        setLastUpdated(now);
      }
    } catch {
      // Ignore background errors, network fallbacks
    } finally {
      isExecutingRef.current = false;
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  // Timer scheduling
  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setIsLive(false);
      return;
    }

    let isTabVisible = true;
    if (typeof document !== "undefined") {
      isTabVisible = document.visibilityState !== "hidden";
    }

    let isOnline = true;
    if (typeof navigator !== "undefined") {
      isOnline = navigator.onLine;
    }

    setIsLive(isTabVisible && isOnline);

    const scheduleNextPoll = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (!enabled || !isTabVisible || !isOnline) {
        return;
      }

      const currentInterval = hasActiveJobs ? activeInterval : idleInterval;

      timerRef.current = setTimeout(async () => {
        await executeRefresh();
        scheduleNextPoll();
      }, currentInterval);
    };

    scheduleNextPoll();

    // Event handlers
    const handleVisibilityChange = () => {
      const visible = document.visibilityState !== "hidden";
      isTabVisible = visible;
      setIsLive(visible && isOnline);

      if (visible && isOnline) {
        // Tab baru aktif kembali -> langsung refresh jika data lebih lama dari 5 detik
        const elapsed = lastUpdatedRef.current
          ? Date.now() - lastUpdatedRef.current.getTime()
          : Infinity;
        if (elapsed > 5000) {
          executeRefresh();
        }
        scheduleNextPoll();
      } else {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    const handleWindowFocus = () => {
      if (!refreshOnFocus || !isOnline || !isTabVisible) return;
      const elapsed = lastUpdatedRef.current
        ? Date.now() - lastUpdatedRef.current.getTime()
        : Infinity;
      // Refresh jika sudah lebih dari interval aktif
      if (elapsed > (hasActiveJobs ? activeInterval : 8000)) {
        executeRefresh();
        scheduleNextPoll();
      }
    };

    const handleOnline = () => {
      isOnline = true;
      setIsLive(isTabVisible);
      executeRefresh();
      scheduleNextPoll();
    };

    const handleOffline = () => {
      isOnline = false;
      setIsLive(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
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
    refreshOnFocus,
    executeRefresh,
  ]);

  return {
    isRefreshing,
    lastUpdated,
    isLive,
    refresh: executeRefresh,
  };
}

