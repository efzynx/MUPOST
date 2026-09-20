"use client";

import React from "react";
import { TikTokLogo } from "@/components/ui/platform-icons";
import { Heart, MessageSquare, Bookmark, Share2, Music, Video as VideoIcon } from "lucide-react";

interface TikTokPreviewProps {
  textContent: string;
  mediaUrls?: string[];
  accountName?: string;
}

export function TikTokPreview({
  textContent,
  mediaUrls = [],
  accountName = "tiktok_creator",
}: TikTokPreviewProps) {
  const firstMedia = mediaUrls.length > 0 ? mediaUrls[0] : null;

  return (
    <div className="w-[280px] h-[498px] mx-auto bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-slate-800 text-white select-none">
      {/* Background Media or Placeholder */}
      <div className="w-full h-full absolute inset-0">
        {firstMedia ? (
          <video
            src={firstMedia}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-slate-900 via-slate-950 to-black flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-3 border border-rose-500/20">
              <VideoIcon className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-rose-400">TikTok memerlukan video</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Upload file MP4/MOV untuk simulasi vertical feed
            </p>
          </div>
        )}
      </div>

      {/* Top Feed tabs simulation */}
      <div className="absolute top-4 inset-x-0 flex items-center justify-center gap-4 text-xs font-semibold z-10 drop-shadow-md">
        <span className="text-white/60">Mengikuti</span>
        <span className="text-white border-b-2 border-white pb-0.5">Untuk Anda</span>
      </div>

      {/* Bottom Gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

      {/* Right Side Action Bar */}
      <div className="absolute right-2.5 bottom-12 flex flex-col items-center gap-3.5 z-10 text-[10px] font-medium">
        {/* Creator Avatar */}
        <div className="relative mb-1">
          <div className="w-9 h-9 rounded-full bg-slate-800 border-2 border-white flex items-center justify-center font-bold text-xs">
            {accountName.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-[10px] font-bold">
            +
          </div>
        </div>

        <button type="button" className="flex flex-col items-center gap-0.5">
          <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Heart className="w-4 h-4 fill-white text-white" />
          </div>
          <span className="drop-shadow">84.2K</span>
        </button>

        <button type="button" className="flex flex-col items-center gap-0.5">
          <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <MessageSquare className="w-4 h-4 fill-white text-white" />
          </div>
          <span className="drop-shadow">1.2K</span>
        </button>

        <button type="button" className="flex flex-col items-center gap-0.5">
          <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Bookmark className="w-4 h-4 fill-white text-white" />
          </div>
          <span className="drop-shadow">5.6K</span>
        </button>

        <button type="button" className="flex flex-col items-center gap-0.5">
          <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="w-4 h-4 fill-white text-white" />
          </div>
          <span className="drop-shadow">Bagikan</span>
        </button>

        {/* Rotating Sound Disc */}
        <div className="w-7 h-7 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center animate-spin duration-3000">
          <Music className="w-3 h-3 text-white" />
        </div>
      </div>

      {/* Bottom Metadata & Caption */}
      <div className="absolute left-3 right-16 bottom-3 z-10 text-left">
        <div className="flex items-center gap-1.5 font-bold text-xs mb-1 drop-shadow">
          <span>@{accountName}</span>
          <TikTokLogo className="w-3 h-3" />
        </div>
        <p className="text-xs leading-snug line-clamp-3 text-slate-100 drop-shadow mb-2 break-words">
          {textContent ? (
            textContent
          ) : (
            <span className="text-slate-400 italic">Deskripsi video...</span>
          )}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-200/90 drop-shadow">
          <Music className="w-3 h-3 animate-pulse" />
          <span className="truncate">Suara asli - @{accountName}</span>
        </div>
      </div>
    </div>
  );
}
