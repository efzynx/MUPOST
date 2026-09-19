"use client";

import React from "react";
import { ThreadsLogo } from "@/components/ui/platform-icons";
import { Heart, MessageCircle, Repeat2, Send, MoreHorizontal } from "lucide-react";

interface ThreadsPreviewProps {
  textContent: string;
  mediaUrls?: string[];
  accountName?: string;
}

export function ThreadsPreview({
  textContent,
  mediaUrls = [],
  accountName = "threads_user",
}: ThreadsPreviewProps) {
  const firstMedia = mediaUrls.length > 0 ? mediaUrls[0] : null;
  const isVideo = firstMedia?.match(/\.(mp4|mov|webm)$/i);

  return (
    <div className="w-full max-w-sm mx-auto bg-black border border-zinc-800 rounded-2xl p-4 text-white shadow-lg select-none transition-all">
      <div className="flex gap-3">
        {/* Left column: Avatar and thread line */}
        <div className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-white">
            {accountName.charAt(0).toUpperCase()}
          </div>
          <div className="w-0.5 flex-1 bg-zinc-800 my-2 min-h-[40px] rounded-full" />
        </div>

        {/* Right column: Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-xs text-white truncate">
                {accountName}
              </span>
              <ThreadsLogo className="w-3 h-3 text-zinc-400 shrink-0" />
              <span className="text-[11px] text-zinc-500 shrink-0">• 1 mnt</span>
            </div>
            <MoreHorizontal className="w-3.5 h-3.5 text-zinc-500" />
          </div>

          {/* Text Content */}
          <div className="text-xs leading-relaxed text-zinc-100 whitespace-pre-wrap break-words">
            {textContent ? (
              textContent
            ) : (
              <span className="text-zinc-600 italic">Mulai thread baru...</span>
            )}
          </div>

          {/* Media */}
          {firstMedia && (
            <div className="mt-3 rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950 max-h-[320px]">
              {isVideo ? (
                <video
                  src={firstMedia}
                  controls
                  className="w-full max-h-[320px] object-contain"
                />
              ) : (
                <img
                  src={firstMedia}
                  alt="Threads post media"
                  className="w-full max-h-[320px] object-cover"
                />
              )}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center gap-4 mt-3 pt-1 text-zinc-300">
            <button type="button" className="hover:text-rose-500 transition-colors">
              <Heart className="w-4 h-4" />
            </button>
            <button type="button" className="hover:text-white transition-colors">
              <MessageCircle className="w-4 h-4" />
            </button>
            <button type="button" className="hover:text-emerald-400 transition-colors">
              <Repeat2 className="w-4 h-4" />
            </button>
            <button type="button" className="hover:text-white transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
