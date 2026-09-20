"use client";

import React from "react";
import { InstagramLogo } from "@/components/ui/platform-icons";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Image as ImageIcon,
} from "lucide-react";

interface InstagramPreviewProps {
  textContent: string;
  mediaUrls?: string[];
  accountName?: string;
}

export function InstagramPreview({
  textContent,
  mediaUrls = [],
  accountName = "instagram_account",
}: InstagramPreviewProps) {
  const firstMedia = mediaUrls.length > 0 ? mediaUrls[0] : null;
  const isVideo = firstMedia?.match(/\.(mp4|mov|webm)$/i);

  return (
    <div className="w-full max-w-sm mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="px-3.5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600">
            <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center font-bold text-xs">
              {accountName.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs tracking-tight">{accountName}</span>
            <InstagramLogo className="w-3 h-3" />
          </div>
        </div>
        <MoreHorizontal className="w-4 h-4 text-slate-400" />
      </div>

      {/* Media Feed Container (1:1 aspect ratio typical for IG) */}
      <div className="w-full aspect-square bg-slate-950 flex items-center justify-center relative overflow-hidden">
        {firstMedia ? (
          isVideo ? (
            <video src={firstMedia} controls className="w-full h-full object-cover" />
          ) : (
            <img src={firstMedia} alt="Instagram preview" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-400 dark:text-slate-500">
            <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center text-amber-500">
              <ImageIcon className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-amber-500/90">
              Media diperlukan untuk Instagram
            </p>
            <p className="text-[11px] text-slate-500">
              Upload foto atau video untuk melihat pratinjau feed
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-3.5 pt-3 pb-1 flex items-center justify-between text-slate-800 dark:text-slate-200">
        <div className="flex items-center gap-4">
          <Heart className="w-5 h-5 hover:text-rose-500 cursor-pointer transition-colors" />
          <MessageCircle className="w-5 h-5 -rotate-90 cursor-pointer" />
          <Send className="w-5 h-5 cursor-pointer" />
        </div>
        <Bookmark className="w-5 h-5 cursor-pointer" />
      </div>

      {/* Caption Content */}
      <div className="px-3.5 pb-4 pt-1.5 text-xs leading-relaxed break-words">
        <span className="font-semibold mr-1.5">{accountName}</span>
        {textContent ? (
          <span className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
            {textContent}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 italic">Tambahkan caption...</span>
        )}
      </div>
    </div>
  );
}
