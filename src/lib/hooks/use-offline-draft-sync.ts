"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "@/components/OfflineBanner";
import {
  getOfflineDrafts,
  getPendingDraftsCount,
  deleteOfflineDraft,
  type OfflineDraft,
} from "@/lib/offline-drafts";
import {
  syncOfflineDrafts,
  type SyncResult,
  isSyncInProgress,
  initBackgroundSyncListeners,
} from "@/lib/offline-sync";

export function useOfflineDraftSync() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const isMountedRef = useRef(true);

  const refreshState = useCallback(async () => {
    try {
      const [count, allDrafts] = await Promise.all([getPendingDraftsCount(), getOfflineDrafts()]);
      if (isMountedRef.current) {
        setPendingCount(count);
        setDrafts(allDrafts);
        setIsSyncing(isSyncInProgress());
      }
    } catch {
      // Fallback diam
    }
  }, []);

  // Setup background sync listeners & event dispatch subscriptions
  useEffect(() => {
    isMountedRef.current = true;
    refreshState();

    const cleanupListeners = initBackgroundSyncListeners();

    const handleDraftsChanged = () => {
      refreshState();
    };

    const handleSyncStatus = (e: Event) => {
      const customEvent = e as CustomEvent<{
        isSyncing?: boolean;
        total?: number;
        succeeded?: number;
        failed?: number;
        errors?: Array<{ id: string; error: string }>;
      }>;

      if (customEvent.detail && isMountedRef.current) {
        setIsSyncing(!!customEvent.detail.isSyncing);
        if (customEvent.detail.succeeded !== undefined) {
          setLastSyncResult({
            total: customEvent.detail.total ?? 0,
            succeeded: customEvent.detail.succeeded ?? 0,
            failed: customEvent.detail.failed ?? 0,
            errors: customEvent.detail.errors ?? [],
          });
        }
      }
      refreshState();
    };

    window.addEventListener("mupost:offline-drafts-changed", handleDraftsChanged);
    window.addEventListener("mupost:offline-sync-status", handleSyncStatus);
    window.addEventListener("mupost:posts-synced", handleDraftsChanged);

    return () => {
      isMountedRef.current = false;
      cleanupListeners();
      window.removeEventListener("mupost:offline-drafts-changed", handleDraftsChanged);
      window.removeEventListener("mupost:offline-sync-status", handleSyncStatus);
      window.removeEventListener("mupost:posts-synced", handleDraftsChanged);
    };
  }, [refreshState]);

  // Otomatis sinkronisasi ketika browser online dan terdapat draft pending
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      syncOfflineDrafts().then((res) => {
        if (isMountedRef.current) {
          setLastSyncResult(res);
          refreshState();
        }
      });
    }
  }, [isOnline, pendingCount, isSyncing, refreshState]);

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await syncOfflineDrafts();
      if (isMountedRef.current) {
        setLastSyncResult(res);
        await refreshState();
      }
      return res;
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [refreshState]);

  const removeDraft = useCallback(
    async (id: string) => {
      const deleted = await deleteOfflineDraft(id);
      if (deleted) {
        await refreshState();
      }
      return deleted;
    },
    [refreshState]
  );

  return {
    isOnline,
    pendingCount,
    drafts,
    isSyncing,
    lastSyncResult,
    syncNow: triggerSync,
    removeDraft,
    reload: refreshState,
  };
}
