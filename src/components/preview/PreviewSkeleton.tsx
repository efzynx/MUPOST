"use client";

import React from "react";
import type { SupportedPlatform } from "./PreviewPanel";

/**
 * Skeleton fallback untuk platform individual saat di-load secara dinamis.
 * Mencegah Cumulative Layout Shift (CLS) saat berpindah tab platform.
 */
export function PlatformPreviewSkeleton({ platform }: { platform?: SupportedPlatform }) {
  return (
    <div
      data-testid="platform-preview-skeleton"
      className="w-full max-w-md mx-auto bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm animate-pulse"
      style={{ minHeight: platform === "tiktok" ? "520px" : "380px" }}
    >
      {/* Header bar skeleton */}
      <div className="p-4 flex items-center justify-between border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800" />
          <div className="space-y-1.5">
            <div className="w-28 h-3.5 rounded bg-zinc-800" />
            <div className="w-16 h-2.5 rounded bg-zinc-800/70" />
          </div>
        </div>
        <div className="w-4 h-4 rounded bg-zinc-800/60" />
      </div>

      {/* Content text lines skeleton */}
      <div className="px-4 py-3 space-y-2">
        <div className="w-full h-3 rounded bg-zinc-800" />
        <div className="w-5/6 h-3 rounded bg-zinc-800/80" />
        <div className="w-2/3 h-3 rounded bg-zinc-800/60" />
      </div>

      {/* Media placeholder skeleton */}
      <div className="w-full h-48 sm:h-56 bg-zinc-800/50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-lg bg-zinc-700/40" />
      </div>

      {/* Action buttons footer skeleton */}
      <div className="p-3 border-t border-zinc-800/60 flex items-center justify-around">
        <div className="w-16 h-4 rounded bg-zinc-800" />
        <div className="w-16 h-4 rounded bg-zinc-800" />
        <div className="w-16 h-4 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

/**
 * Skeleton loader halus untuk seluruh PreviewPanel saat dimuat menggunakan next/dynamic.
 * Memastikan area panel tidak melompat (Zero CLS).
 */
export function PreviewPanelSkeleton() {
  return (
    <div
      data-testid="preview-panel-skeleton"
      className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-sm min-h-[460px] animate-pulse"
      aria-busy="true"
      aria-label="Memuat pratinjau..."
    >
      {/* Top Bar: Tabs & Character Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        {/* Platform Tabs Skeleton */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-950/80 rounded-lg border border-zinc-800">
          <div className="w-20 h-7 rounded-md bg-zinc-800" />
          <div className="w-20 h-7 rounded-md bg-zinc-800/50 hidden sm:block" />
          <div className="w-20 h-7 rounded-md bg-zinc-800/50 hidden md:block" />
        </div>

        {/* Character Limit Badge Skeleton */}
        <div className="w-20 h-5 rounded-full bg-zinc-800" />
      </div>

      {/* Preview Simulation Container Skeleton */}
      <div className="py-2 flex items-center justify-center">
        <PlatformPreviewSkeleton />
      </div>
    </div>
  );
}
