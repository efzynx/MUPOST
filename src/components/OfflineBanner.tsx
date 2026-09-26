"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { WifiOff, CheckCircle2, RefreshCw, X, AlertCircle, CloudUpload } from "lucide-react";
import { useOfflineDraftSync } from "@/lib/hooks/use-offline-draft-sync";

/**
 * Hook untuk memantau status koneksi internet browser secara reaktif.
 * Mempertahankan backward compatibility untuk komponen yang mengonsumsinya.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Komponen Banner persisten & reaktif di bagian atas layar.
 * Menampilkan deteksi konektivitas, status draft offline, dan background synchronization.
 */
export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, lastSyncResult, syncNow } = useOfflineDraftSync();

  const [showReconnected, setShowReconnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const wasOfflineRef = useRef(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Deteksi transisi offline -> online
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      setShowReconnected(false);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    } else if (wasOfflineRef.current) {
      // Saat koneksi pulih setelah sebelumnya offline
      setShowReconnected(true);
      wasOfflineRef.current = false;

      dismissTimerRef.current = setTimeout(() => {
        setShowReconnected(false);
      }, 6000);
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [isOnline]);

  // Handler pengecekan koneksi manual saat offline
  const handleCheckConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      if (typeof window !== "undefined" && typeof navigator !== "undefined") {
        if (!navigator.onLine) {
          setIsChecking(false);
          return;
        }

        // Cek konektivitas sebenarnya ke backend dengan timeout singkat
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
      }
    } catch {
      // Tetap offline jika fetch gagal
    } finally {
      setIsChecking(false);
    }
  }, []);

  // 1. Tampilan saat Sedang Sinkronisasi di Background (Online & isSyncing)
  if (isOnline && isSyncing) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="syncing-banner"
        className="sticky top-0 z-50 w-full bg-cyan-700 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm font-medium transition-all animate-in fade-in slide-in-from-top-1"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-cyan-200" />
          <div className="leading-tight">
            <span className="font-semibold">Sinkronisasi Background Aktif</span>
            <span className="hidden sm:inline"> — </span>
            <span className="text-cyan-100 block sm:inline mt-0.5 sm:mt-0">
              Menyinkronkan {pendingCount > 0 ? `${pendingCount} ` : ""}draft offline ke server...
            </span>
          </div>
        </div>
        <span className="text-[11px] font-mono bg-cyan-800/80 px-2 py-0.5 rounded text-cyan-200 shrink-0">
          Syncing...
        </span>
      </div>
    );
  }

  // 2. Tampilan saat Offline
  if (!isOnline) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="offline-banner"
        className="sticky top-0 z-50 w-full bg-amber-500 text-amber-950 px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-medium transition-all"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-950" />
          <div className="leading-tight">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">Mode Offline Aktif</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600/40 text-amber-950 border border-amber-600/50">
                  {pendingCount} Draft Tersimpan Lokal
                </span>
              )}
            </div>
            <span className="text-amber-900 block sm:inline mt-0.5 sm:mt-0 font-normal sm:font-medium">
              Draft post tetap dapat dibuat &amp; diedit di perangkat ini. Sinkronisasi otomatis
              berjalan saat online.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCheckConnection}
            disabled={isChecking}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-600/30 hover:bg-amber-600/40 text-amber-950 border border-amber-600/50 text-xs font-semibold transition-colors disabled:opacity-50 touch-manipulation"
          >
            <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
            <span>{isChecking ? "Memeriksa..." : "Periksa Koneksi"}</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Tampilan jika Sinkronisasi memiliki kegagalan saat online
  if (isOnline && lastSyncResult && lastSyncResult.failed > 0 && pendingCount > 0) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="sync-error-banner"
        className="sticky top-0 z-50 w-full bg-amber-600 text-amber-50 px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm font-medium transition-all animate-in fade-in"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-200" />
          <div className="leading-tight">
            <span className="font-semibold">Sinkronisasi Tertunda</span>
            <span className="hidden sm:inline"> — </span>
            <span className="text-amber-100 block sm:inline mt-0.5 sm:mt-0">
              {lastSyncResult.failed} draft offline belum berhasil disinkronkan ke server.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => syncNow()}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded bg-amber-700/60 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Coba Lagi</span>
        </button>
      </div>
    );
  }

  // 4. Tampilan saat Kembali Online (auto-dismiss dalam 6 detik)
  if (showReconnected) {
    const hasSyncedDrafts = lastSyncResult && lastSyncResult.succeeded > 0;

    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="online-banner"
        className="sticky top-0 z-50 w-full bg-emerald-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm font-medium transition-all animate-in fade-in slide-in-from-top-1 duration-300"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {hasSyncedDrafts ? (
            <CloudUpload className="w-4 h-4 shrink-0 text-emerald-200" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
          )}
          <div className="leading-tight">
            <span className="font-semibold">
              {hasSyncedDrafts ? "Koneksi Pulih & Draft Tersinkronkan" : "Koneksi Internet Pulih"}
            </span>
            <span className="hidden sm:inline"> — </span>
            <span className="text-emerald-100 block sm:inline mt-0.5 sm:mt-0">
              {hasSyncedDrafts
                ? `${lastSyncResult.succeeded} draft offline berhasil disinkronkan ke server.`
                : "Semua fitur kini aktif kembali. Data terbaru siap disinkronkan."}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowReconnected(false)}
          className="shrink-0 p-1 rounded hover:bg-emerald-700/50 text-emerald-100 hover:text-white transition-colors"
          aria-label="Tutup pemberitahuan"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}
