/**
 * Background Synchronization Engine
 * Menangani sinkronisasi otomatis draft offline ke backend API saat koneksi pulih.
 */

import { apiFetch } from "@/lib/api-client";
import { invalidatePostsCache } from "@/lib/pwa-cache";
import { getOfflineDrafts, deleteOfflineDraft, updateOfflineDraft } from "@/lib/offline-drafts";

export interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

let syncInProgress = false;

export function isSyncInProgress(): boolean {
  return syncInProgress;
}

function broadcastSyncStatus(detail: {
  isSyncing: boolean;
  total?: number;
  succeeded?: number;
  failed?: number;
  progress?: number;
  errors?: Array<{ id: string; error: string }>;
}) {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(
        new CustomEvent("mupost:offline-sync-status", {
          detail: { ...detail, timestamp: Date.now() },
        })
      );
    } catch {
      // Abaikan jika CustomEvent tidak didukung
    }
  }
}

/**
 * Mengeksekusi sinkronisasi draft postingan offline ke server.
 */
export async function syncOfflineDrafts(options?: {
  onProgress?: (synced: number, total: number) => void;
}): Promise<SyncResult> {
  // Jika sedang berjalan atau di environment tanpa window/fetch
  if (syncInProgress) {
    return { total: 0, succeeded: 0, failed: 0, errors: [] };
  }

  // Cek apakah browser sedang offline
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { total: 0, succeeded: 0, failed: 0, errors: [] };
  }

  const allDrafts = await getOfflineDrafts();
  const pendingDrafts = allDrafts.filter(
    (d) => d.syncStatus === "pending" || d.syncStatus === "failed"
  );

  if (pendingDrafts.length === 0) {
    return { total: 0, succeeded: 0, failed: 0, errors: [] };
  }

  syncInProgress = true;
  broadcastSyncStatus({ isSyncing: true, total: pendingDrafts.length, progress: 0 });

  const result: SyncResult = {
    total: pendingDrafts.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  try {
    for (let i = 0; i < pendingDrafts.length; i++) {
      const draft = pendingDrafts[i];
      if (!draft) continue;

      // Tandai draft sedang disinkronkan
      await updateOfflineDraft(draft.id, { syncStatus: "syncing" });

      try {
        let isSuccess = false;
        let errorMessage: string | null = null;

        // Jika mengedit post yang sudah ada di server (memiliki postId dan bukan id offline murni)
        if (draft.postId && !draft.id.startsWith("offline_")) {
          const res = await apiFetch(`/api/posts/${draft.postId}`, {
            method: "PATCH",
            body: JSON.stringify({
              textContent: draft.textContent,
              mediaUrls: draft.mediaUrls.length > 0 ? draft.mediaUrls : [],
              targetAccountIds: draft.targetAccountIds,
              scheduledAt: draft.scheduledAt,
            }),
          });

          if (res.ok) {
            isSuccess = true;
          } else {
            const errData = res.data as unknown as { error?: { message?: string } };
            errorMessage = errData?.error?.message || "Gagal memperbarui post di server.";
          }
        } else {
          // Membuat post draft baru di server
          const res = await apiFetch("/api/posts", {
            method: "POST",
            body: JSON.stringify({
              textContent: draft.textContent,
              mediaUrls: draft.mediaUrls.length > 0 ? draft.mediaUrls : undefined,
              targetAccountIds: draft.targetAccountIds,
              scheduledAt: draft.scheduledAt,
            }),
          });

          if (res.ok) {
            isSuccess = true;
          } else {
            const errData = res.data as unknown as { error?: { message?: string } };
            errorMessage = errData?.error?.message || "Gagal membuat draft post di server.";
          }
        }

        if (isSuccess) {
          // Hapus draft offline yang berhasil disinkronkan
          await deleteOfflineDraft(draft.id);
          result.succeeded++;
        } else {
          await updateOfflineDraft(draft.id, {
            syncStatus: "failed",
            lastSyncError: errorMessage,
            retryCount: (draft.retryCount || 0) + 1,
          });
          result.failed++;
          result.errors.push({ id: draft.id, error: errorMessage || "Gagal sinkron" });
        }
      } catch (err: unknown) {
        const errorText =
          err instanceof Error ? err.message : "Kesalahan jaringan saat sinkronisasi";
        await updateOfflineDraft(draft.id, {
          syncStatus: "failed",
          lastSyncError: errorText,
          retryCount: (draft.retryCount || 0) + 1,
        });
        result.failed++;
        result.errors.push({ id: draft.id, error: errorText });
      }

      options?.onProgress?.(result.succeeded, pendingDrafts.length);
      broadcastSyncStatus({
        isSyncing: true,
        total: pendingDrafts.length,
        progress: Math.round(((i + 1) / pendingDrafts.length) * 100),
      });
    }

    // Jika setidaknya 1 draft berhasil disinkronkan, hapus cache posts PWA agar UI mengambil data segar
    if (result.succeeded > 0) {
      await invalidatePostsCache();
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("mupost:posts-synced", { detail: result }));
      }
    }
  } finally {
    syncInProgress = false;
    broadcastSyncStatus({
      isSyncing: false,
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      errors: result.errors,
    });
  }

  return result;
}

/**
 * Inisialisasi listener event online browser dan Service Worker messages.
 * Mengembalikan fungsi cleanup untuk unregister listener.
 */
export function initBackgroundSyncListeners(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleOnline = () => {
    // Jalankan auto-sync saat browser kembali online
    syncOfflineDrafts().catch(() => {});
  };

  const handleSWMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === "SYNC_OFFLINE_DRAFTS") {
      syncOfflineDrafts().catch(() => {});
    }
  };

  window.addEventListener("online", handleOnline);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", handleSWMessage);
  }

  return () => {
    window.removeEventListener("online", handleOnline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.removeEventListener("message", handleSWMessage);
    }
  };
}
