"use client";

import React, { useMemo } from "react";
import {
  type PlatformType,
  validateMultiPlatformConstraints,
  type PlatformValidationResult,
} from "@/lib/platform-constraints";
import {
  FacebookLogo,
  InstagramLogo,
  TikTokLogo,
  ThreadsLogo,
} from "@/components/ui/platform-icons";
import { AlertCircle, AlertTriangle, CheckCircle2, Video, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformConstraintValidatorProps {
  selectedPlatforms: PlatformType[];
  textContent: string;
  mediaUrls?: string[];
  className?: string;
  compact?: boolean;
}

function getPlatformIcon(platform: PlatformType, size = "w-4 h-4") {
  switch (platform) {
    case "META_PAGE":
      return <FacebookLogo className={size} />;
    case "INSTAGRAM":
      return <InstagramLogo className={size} />;
    case "TIKTOK":
      return <TikTokLogo className={size} />;
    case "THREADS":
      return <ThreadsLogo className={size} />;
  }
}

export function PlatformConstraintValidator({
  selectedPlatforms,
  textContent,
  mediaUrls = [],
  className,
  compact = false,
}: PlatformConstraintValidatorProps) {
  const summary = useMemo(() => {
    return validateMultiPlatformConstraints(selectedPlatforms, textContent, mediaUrls);
  }, [selectedPlatforms, textContent, mediaUrls]);

  if (selectedPlatforms.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-4 text-xs text-zinc-500 text-center bg-zinc-50/50 dark:bg-zinc-900/30",
          className
        )}
      >
        <span className="flex items-center justify-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-zinc-400" />
          Pilih minimal 1 akun tujuan untuk mengaktifkan validasi batasan platform secara realtime.
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-3", className)}
      role="region"
      aria-label="Validasi Batasan Platform"
    >
      {/* Header bar: Strictest limit & overall status */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          {summary.hasBlockingErrors ? (
            <span className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Batasan Belum Terpenuhi
            </span>
          ) : summary.hasWarnings ? (
            <span className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Mendekati Batas
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Sesuai Batasan Platform
            </span>
          )}
        </div>

        {summary.strictestCharLimit && (
          <div className="flex items-center gap-1.5 ml-auto text-[11px] font-mono">
            <span className="text-zinc-500">Batas Terketat:</span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {summary.strictestCharLimit.platformName} (
              {summary.strictestCharLimit.maxCharacters.toLocaleString()})
            </span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full font-bold",
                summary.strictestCharLimit.charStatus === "exceeded"
                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                  : summary.strictestCharLimit.charStatus === "warning"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              )}
            >
              {summary.strictestCharLimit.charCount.toLocaleString()} /{" "}
              {summary.strictestCharLimit.maxCharacters.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Grid of validation cards per selected platform */}
      <div className={cn("grid gap-2.5", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
        {summary.validations.map((v) => (
          <PlatformConstraintCard key={v.platform} validation={v} />
        ))}
      </div>

      {/* Screen reader live notification */}
      <div className="sr-only" aria-live="polite">
        {summary.blockingReasons.join(". ")}
      </div>
    </div>
  );
}

function PlatformConstraintCard({ validation: v }: { validation: PlatformValidationResult }) {
  const isExceeded = v.charStatus === "exceeded";
  const isWarning = v.charStatus === "warning";
  const hasMediaError = v.mediaStatus === "error";

  return (
    <div
      className={cn(
        "p-3.5 rounded-xl border transition-all text-xs space-y-2.5",
        !v.isValid
          ? "border-red-500/40 bg-red-50/50 dark:bg-red-950/20 shadow-sm"
          : isWarning
            ? "border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm"
            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40"
      )}
    >
      {/* Platform Title + Badge Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {getPlatformIcon(v.platform, "w-4 h-4 shrink-0")}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{v.platformName}</span>
        </div>

        <span
          className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1",
            !v.isValid
              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              : isWarning
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          )}
        >
          {!v.isValid ? (
            <>
              <AlertCircle className="w-3 h-3" /> Error
            </>
          ) : isWarning ? (
            <>
              <AlertTriangle className="w-3 h-3" /> Peringatan
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3" /> Lolos
            </>
          )}
        </span>
      </div>

      {/* Progress Bar & Character Counter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-zinc-500">Karakter</span>
          <span
            className={cn(
              "font-medium",
              isExceeded
                ? "text-red-600 dark:text-red-400 font-bold"
                : isWarning
                  ? "text-amber-600 dark:text-amber-400 font-bold"
                  : "text-zinc-700 dark:text-zinc-300"
            )}
          >
            {v.charCount.toLocaleString()} / {v.maxCharacters.toLocaleString()}
            {isExceeded && (
              <span className="ml-1 text-[10px] text-red-500">(+{Math.abs(v.remainingChars)})</span>
            )}
            {!isExceeded && (
              <span className="ml-1 text-[10px] text-zinc-400">
                (sisa {v.remainingChars.toLocaleString()})
              </span>
            )}
          </span>
        </div>

        {/* Dynamic Visual Progress Bar */}
        <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              isExceeded ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
            )}
            style={{ width: `${Math.min(100, v.percentageUsed)}%` }}
          />
        </div>
      </div>

      {/* Media Constraint Feedback if applicable */}
      {v.platform === "TIKTOK" && (
        <div
          className={cn(
            "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border",
            hasMediaError
              ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 font-medium"
              : "bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-300"
          )}
        >
          <Video className="w-3.5 h-3.5 shrink-0" />
          <span>{v.hasVideo ? "Video terlampir" : "Wajib menyertakan file video"}</span>
        </div>
      )}

      {v.platform === "INSTAGRAM" && (
        <div
          className={cn(
            "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border",
            hasMediaError
              ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 font-medium"
              : "bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-300"
          )}
        >
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>
            {v.hasMedia
              ? `${v.mediaCount} media terlampir (maks 10)`
              : "Wajib minimal 1 gambar/video"}
          </span>
        </div>
      )}

      {/* Errors or Warnings List */}
      {v.errors.length > 0 && (
        <ul className="space-y-1 pt-1 border-t border-red-200 dark:border-red-900/40">
          {v.errors.map((err, i) => (
            <li
              key={i}
              className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1.5 leading-snug"
            >
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{err}</span>
            </li>
          ))}
        </ul>
      )}

      {v.warnings.length > 0 && v.errors.length === 0 && (
        <ul className="space-y-1 pt-1 border-t border-amber-200 dark:border-amber-900/40">
          {v.warnings.map((warn, i) => (
            <li
              key={i}
              className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5 leading-snug"
            >
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{warn}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
