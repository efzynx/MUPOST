"use client";

import React, { useState, useEffect } from "react";
import { FacebookPreview } from "./FacebookPreview";
import { InstagramPreview } from "./InstagramPreview";
import { TikTokPreview } from "./TikTokPreview";
import { ThreadsPreview } from "./ThreadsPreview";
import { PLATFORM_LIMITS } from "@/lib/services/preview-engine";
import {
  FacebookLogo,
  InstagramLogo,
  TikTokLogo,
  ThreadsLogo,
} from "@/components/ui/platform-icons";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Eye, AlertTriangle } from "lucide-react";

export type SupportedPlatform = "facebook" | "instagram" | "tiktok" | "threads";

interface PreviewPanelProps {
  textContent: string;
  mediaUrls: string[];
  selectedPlatforms: SupportedPlatform[];
  accountNames?: Partial<Record<SupportedPlatform, string>>;
}

export function PreviewPanel({
  textContent,
  mediaUrls,
  selectedPlatforms,
  accountNames = {},
}: PreviewPanelProps) {
  // Debounced input state (300ms) untuk kepatuhan Requirement 7.1
  const [debouncedText, setDebouncedText] = useState(textContent);
  const [debouncedMedia, setDebouncedMedia] = useState(mediaUrls);
  const [activePlatform, setActivePlatform] = useState<SupportedPlatform | null>(
    selectedPlatforms.length > 0 ? (selectedPlatforms[0] ?? null) : null
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText(textContent);
      setDebouncedMedia(mediaUrls);
    }, 300);

    return () => clearTimeout(timer);
  }, [textContent, mediaUrls]);

  // Update active platform jika list platform berubah
  useEffect(() => {
    if (selectedPlatforms.length > 0) {
      if (!activePlatform || !selectedPlatforms.includes(activePlatform)) {
        setActivePlatform(selectedPlatforms[0] ?? null);
      }
    } else {
      setActivePlatform(null);
    }
  }, [selectedPlatforms, activePlatform]);

  if (selectedPlatforms.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center flex flex-col items-center justify-center min-h-[360px]">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <Eye className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-200">Pratinjau Postingan</h4>
        <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
          Pilih minimal satu akun platform tujuan di samping untuk melihat pratinjau tampilan feed.
        </p>
      </div>
    );
  }

  const currentPlatform: SupportedPlatform = activePlatform || selectedPlatforms[0] || "facebook";
  const charLimit = PLATFORM_LIMITS[currentPlatform];
  const charCount = debouncedText.length;
  const exceedsLimit = charCount > charLimit;
  const requiresMedia = currentPlatform === "instagram" || currentPlatform === "tiktok";
  const hasMedia = debouncedMedia.length > 0;
  const missingMediaWarning = requiresMedia && !hasMedia;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
      {/* Top Bar: Tabs and Character Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        {/* Platform Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-lg border border-slate-800">
          {selectedPlatforms.map((p) => {
            const isActive = p === currentPlatform;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setActivePlatform(p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                {p === "facebook" && <FacebookLogo className="w-3.5 h-3.5" />}
                {p === "instagram" && <InstagramLogo className="w-3.5 h-3.5" />}
                {p === "tiktok" && <TikTokLogo className="w-3.5 h-3.5" />}
                {p === "threads" && <ThreadsLogo className="w-3.5 h-3.5" />}
                <span className="capitalize">{p}</span>
              </button>
            );
          })}
        </div>

        {/* Character Limit Badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant={exceedsLimit ? "failed" : "outline"}
            className={`text-[11px] font-mono transition-colors ${
              exceedsLimit
                ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                : "bg-slate-800/80 text-slate-300 border-slate-700"
            }`}
          >
            {charCount.toLocaleString("id-ID")} / {charLimit.toLocaleString("id-ID")}
          </Badge>
        </div>
      </div>

      {/* Warning: Exceeds Limit */}
      {exceedsLimit && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            Jumlah karakter melebihi batas maksimal {currentPlatform} (
            {charLimit.toLocaleString("id-ID")} karakter). Silakan persingkat teks.
          </span>
        </div>
      )}

      {/* Warning: Missing Media */}
      {missingMediaWarning && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Platform <strong className="capitalize">{currentPlatform}</strong> memerlukan media (
            {currentPlatform === "tiktok" ? "video" : "gambar atau video"}) untuk dapat
            dipublikasikan.
          </span>
        </div>
      )}

      {/* Preview Simulation Container */}
      <div className="py-2 flex items-center justify-center">
        {currentPlatform === "facebook" && (
          <FacebookPreview
            textContent={debouncedText}
            mediaUrls={debouncedMedia}
            accountName={accountNames.facebook || "Halaman Facebook"}
          />
        )}
        {currentPlatform === "instagram" && (
          <InstagramPreview
            textContent={debouncedText}
            mediaUrls={debouncedMedia}
            accountName={accountNames.instagram || "instagram_user"}
          />
        )}
        {currentPlatform === "tiktok" && (
          <TikTokPreview
            textContent={debouncedText}
            mediaUrls={debouncedMedia}
            accountName={accountNames.tiktok || "tiktok_creator"}
          />
        )}
        {currentPlatform === "threads" && (
          <ThreadsPreview
            textContent={debouncedText}
            mediaUrls={debouncedMedia}
            accountName={accountNames.threads || "threads_user"}
          />
        )}
      </div>
    </div>
  );
}
