"use client";

import React from "react";
import { FacebookLogo } from "@/components/ui/platform-icons";
import { ThumbsUp, MessageCircle, Share2, Globe } from "lucide-react";

interface FacebookPreviewProps {
  textContent: string;
  mediaUrls?: string[];
  accountName?: string;
}

export function FacebookPreview({
  textContent,
  mediaUrls = [],
  accountName = "Facebook Page",
}: FacebookPreviewProps) {
  const firstMedia = mediaUrls.length > 0 ? mediaUrls[0] : null;
  const isVideo = firstMedia?.match(/\.(mp4|mov|webm)$/i);

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
            {accountName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-sm leading-snug flex items-center gap-1.5">
              <span>{accountName}</span>
              <FacebookLogo className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>Baru saja</span>
              <span>•</span>
              <Globe className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Text Content */}
      <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {textContent ? (
          textContent
        ) : (
          <span className="text-slate-400 dark:text-slate-500 italic">
            Teks postingan akan muncul di sini...
          </span>
        )}
      </div>

      {/* Media Container */}
      {firstMedia && (
        <div className="w-full bg-slate-950 flex items-center justify-center overflow-hidden max-h-[420px]">
          {isVideo ? (
            <video
              src={firstMedia}
              controls
              className="w-full max-h-[420px] object-contain"
            />
          ) : (
            <img
              src={firstMedia}
              alt="Preview media"
              className="w-full max-h-[420px] object-cover"
            />
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="px-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-around text-xs font-semibold text-slate-600 dark:text-slate-400">
        <button
          type="button"
          className="flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ThumbsUp className="w-4 h-4" />
          <span>Suka</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Komentar</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          <span>Bagikan</span>
        </button>
      </div>
    </div>
  );
}
