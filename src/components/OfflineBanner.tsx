"use client";

import React, { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

/**
 * Hook untuk memantau status koneksi internet browser secara reaktif.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // Inisialisasi awal saat di client
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
 * Komponen Banner persisten di bagian atas layar saat browser offline.
 * Sesuai Requirement 13.3.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="offline-banner"
      className="sticky top-0 z-50 w-full bg-amber-500 text-amber-950 px-4 py-2.5 shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm font-medium transition-all"
    >
      <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
      <span>
        Anda sedang dalam mode offline. Menampilkan data dari cache. Fitur pembuatan, pengeditan,
        dan publikasi dinonaktifkan.
      </span>
    </div>
  );
}
