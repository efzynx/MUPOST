"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, Radio, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusTransition } from "@/lib/hooks/use-smart-polling";

interface LiveSyncIndicatorProps {
  isLive: boolean;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  hasActiveJobs: boolean;
  onRefresh: () => void;
  className?: string;
}

export function LiveSyncIndicator({
  isLive,
  isRefreshing,
  lastUpdated,
  hasActiveJobs,
  onRefresh,
  className,
}: LiveSyncIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState<string>("Baru saja");

  useEffect(() => {
    if (!lastUpdated) return;

    const updateLabel = () => {
      const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (seconds < 5) {
        setTimeAgo("Baru saja");
      } else if (seconds < 60) {
        setTimeAgo(`${seconds} detik lalu`);
      } else {
        const mins = Math.floor(seconds / 60);
        setTimeAgo(`${mins} menit lalu`);
      }
    };

    updateLabel();
    const interval = setInterval(updateLabel, 5000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <div
      className={cn(
        "flex items-center justify-between sm:justify-end gap-2.5 py-1.5 px-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="relative flex h-2 w-2 shrink-0">
          {isLive ? (
            <>
              <span
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  hasActiveJobs ? "bg-cyan-400" : "bg-emerald-400"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  hasActiveJobs ? "bg-cyan-500" : "bg-emerald-500"
                )}
              />
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600" />
          )}
        </span>

        <span className="text-[11px] font-medium text-zinc-300 truncate">
          {hasActiveJobs ? (
            <span className="text-cyan-400 flex items-center gap-1.5 font-semibold">
              <Loader2 className="w-3 h-3 animate-spin inline shrink-0" />
              <span>Memproses Antrean (3s)</span>
            </span>
          ) : isLive ? (
            <span className="text-zinc-400">
              Live updates <span className="hidden sm:inline">· {timeAgo}</span>
            </span>
          ) : (
            <span className="text-zinc-500">Live jeda</span>
          )}
        </span>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label="Segarkan data sekarang"
        className={cn(
          "inline-flex items-center justify-center min-h-[36px] min-w-[36px] sm:min-h-[28px] sm:min-w-[28px] p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 active:scale-95 transition-all disabled:opacity-50 touch-manipulation",
          isRefreshing && "text-cyan-400"
        )}
        title="Segarkan status secara manual"
      >
        <RefreshCw
          className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-cyan-400")}
        />
        <span className="sr-only">Segarkan</span>
      </button>
    </div>
  );
}

interface TransitionToastProps {
  notifications: StatusTransition[];
  onDismiss: (id: string) => void;
}

export function TransitionToastList({ notifications, onDismiss }: TransitionToastProps) {
  if (notifications.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Pemberitahuan perubahan status"
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 max-w-sm w-[calc(100vw-2rem)] sm:w-80 flex flex-col gap-2 pointer-events-none"
    >
      {notifications.map((n) => {
        const isSuccess = n.newStatus === "PUBLISHED";
        const isFailed = n.newStatus === "FAILED";
        const isProcessing = n.newStatus === "PUBLISHING" || n.newStatus === "QUEUED";

        return (
          <div
            key={`${n.postId}-${n.timestamp}`}
            className={cn(
              "pointer-events-auto p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 flex items-start gap-3 text-xs",
              isSuccess && "bg-zinc-950/95 border-emerald-500/50 text-emerald-300 shadow-emerald-950/30",
              isFailed && "bg-zinc-950/95 border-red-500/50 text-red-300 shadow-red-950/30",
              isProcessing && "bg-zinc-950/95 border-cyan-500/50 text-cyan-300 shadow-cyan-950/30",
              !isSuccess && !isFailed && !isProcessing && "bg-zinc-950/95 border-zinc-700 text-zinc-300"
            )}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {isFailed && <AlertCircle className="w-4 h-4 text-red-400" />}
              {isProcessing && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
              {!isSuccess && !isFailed && !isProcessing && <Radio className="w-4 h-4 text-zinc-400" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-zinc-100">
                {isSuccess
                  ? "Postingan Terpublikasi!"
                  : isFailed
                  ? "Gagal Publikasi Postingan"
                  : isProcessing
                  ? "Postingan Sedang Diproses"
                  : `Status Berubah: ${n.newStatus}`}
              </p>
              <p className="text-zinc-400 line-clamp-1 mt-0.5 text-[11px]">
                {n.textContent}
              </p>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                {n.oldStatus} &rarr; {n.newStatus}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(n.postId)}
              aria-label="Tutup notifikasi"
              className="shrink-0 p-1.5 -mr-1 -mt-1 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center touch-manipulation"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
