"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { WifiOff, CheckCircle2, RefreshCw, X } from "lucide-react";

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
 * Memberikan deteksi konektivitas real-time dan instruksi jelas saat offline maupun saat kembali online.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
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
      }, 5000);
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

  // 1. Tampilan saat Offline
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
            <span className="font-semibold">Mode Offline Aktif</span>
            <span className="hidden sm:inline"> — Menampilkan data dari cache lokal. </span>
            <span className="text-amber-900 block sm:inline mt-0.5 sm:mt-0 font-normal sm:font-medium">
              Fitur pembuatan, pengeditan, dan publikasi dinonaktifkan sementara. Periksa koneksi
              internet Anda.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCheckConnection}
          disabled={isChecking}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-600/30 hover:bg-amber-600/40 text-amber-950 border border-amber-600/50 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
          <span>{isChecking ? "Memeriksa..." : "Periksa Koneksi"}</span>
        </button>
      </div>
    );
  }

  // 2. Tampilan saat Kembali Online (auto-dismiss dalam 5 detik)
  if (showReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="online-banner"
        className="sticky top-0 z-50 w-full bg-emerald-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm font-medium transition-all animate-in fade-in slide-in-from-top-1 duration-300"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
          <div className="leading-tight">
            <span className="font-semibold">Koneksi Internet Pulih</span>
            <span className="hidden sm:inline"> — </span>
            <span className="text-emerald-100 block sm:inline mt-0.5 sm:mt-0">
              Semua fitur kini aktif kembali. Data terbaru siap disinkronkan.
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
