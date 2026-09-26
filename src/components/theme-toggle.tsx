"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ThemeMode, getNextTheme, getNextThemeIndex, THEME_METADATA } from "@/lib/theme";

export interface ThemeToggleProps {
  variant?: "segmented" | "compact" | "cards";
  className?: string;
  showLabels?: boolean;
}

export interface ThemeOption {
  value: ThemeMode;
  label: string;
  fullLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const THEME_ICONS: Record<ThemeMode, React.ComponentType<{ className?: string }>> = {
  light: Sun,
  dark: Moon,
  system: Laptop,
};

export const THEME_OPTIONS: ThemeOption[] = THEME_METADATA.map((meta) => ({
  ...meta,
  icon: THEME_ICONS[meta.value],
}));

export function ThemeToggle({
  variant = "segmented",
  className,
  showLabels = false,
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard navigation untuk ARIA radio group (ArrowLeft/ArrowRight/ArrowUp/ArrowDown)
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = getNextThemeIndex(currentIndex, "next");
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = getNextThemeIndex(currentIndex, "prev");
    }
    const targetOption = THEME_OPTIONS[nextIndex];
    if (targetOption) {
      setTheme(targetOption.value);
    }
  };

  // Placeholder sebelum mounted agar mencegah Cumulative Layout Shift (CLS) dan mismatch SSR
  if (!mounted) {
    if (variant === "compact") {
      return (
        <div
          aria-hidden="true"
          className={cn(
            "w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse",
            className
          )}
        />
      );
    }
    if (variant === "cards") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-zinc-900/60 border border-zinc-800 animate-pulse"
            />
          ))}
        </div>
      );
    }
    return (
      <div
        aria-hidden="true"
        className={cn(
          "inline-flex h-8 items-center rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse",
          showLabels ? "w-full" : "w-[92px]",
          className
        )}
      />
    );
  }

  // 1. Variant COMPACT (untuk Mobile Header atau bar ringkas)
  if (variant === "compact") {
    const nextTheme = getNextTheme(theme);
    const nextLabel =
      nextTheme === "light" ? "Terang" : nextTheme === "dark" ? "Gelap" : "Auto (Sistem)";

    const CurrentIcon = theme === "system" ? Laptop : resolvedTheme === "dark" ? Moon : Sun;

    return (
      <button
        type="button"
        onClick={() => setTheme(nextTheme)}
        aria-label={`Tema aktif: ${theme === "system" ? "Auto" : theme === "dark" ? "Gelap" : "Terang"}. Klik untuk beralih ke tema ${nextLabel}.`}
        title={`Tema saat ini: ${theme === "system" ? "Auto" : theme === "dark" ? "Gelap" : "Terang"} (Klik untuk ganti ke ${nextLabel})`}
        className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
          className
        )}
      >
        <CurrentIcon className="w-4 h-4 transition-transform duration-200" />
      </button>
    );
  }

  // 2. Variant CARDS (untuk Halaman Pengaturan / Settings)
  if (variant === "cards") {
    return (
      <div
        role="radiogroup"
        aria-label="Pilih preferensi tema tampilan"
        className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3.5", className)}
      >
        {THEME_OPTIONS.map((opt, idx) => {
          const Icon = opt.icon;
          const isSelected = theme === opt.value;

          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Tema ${opt.fullLabel}`}
              tabIndex={isSelected || (!theme && opt.value === "system") ? 0 : -1}
              onClick={() => setTheme(opt.value)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={cn(
                "relative flex flex-col p-4 rounded-xl border text-left transition-all duration-200 group select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
                isSelected
                  ? "bg-zinc-900 border-zinc-500 shadow-md ring-1 ring-zinc-500/50"
                  : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
              )}
            >
              {/* Header Card */}
              <div className="flex items-center justify-between w-full mb-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                    isSelected
                      ? "bg-zinc-100 text-zinc-950 border-zinc-200 shadow-sm"
                      : "bg-zinc-800/80 text-zinc-300 border-zinc-700 group-hover:text-zinc-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 shadow-sm">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <div className="font-semibold text-sm text-zinc-100 mb-1">{opt.fullLabel}</div>
              <p className="text-xs text-zinc-400 leading-relaxed">{opt.description}</p>
            </button>
          );
        })}
      </div>
    );
  }

  // 3. Variant SEGMENTED (3-icon pill minimalis untuk Sidebar Desktop & panel navigasi)
  return (
    <div
      role="radiogroup"
      aria-label="Pilih tema tampilan"
      className={cn(
        "inline-flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800/80 text-xs select-none",
        className
      )}
    >
      {THEME_OPTIONS.map((opt, idx) => {
        const Icon = opt.icon;
        const isSelected = theme === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`Tema ${opt.fullLabel}`}
            tabIndex={isSelected || (!theme && opt.value === "system") ? 0 : -1}
            onClick={() => setTheme(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            title={`Tema ${opt.fullLabel}`}
            className={cn(
              "flex items-center justify-center rounded-md font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
              showLabels ? "flex-1 gap-1.5 py-1 px-2 text-xs" : "h-7 w-7 text-zinc-400",
              isSelected
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {showLabels && <span className="text-[11px] truncate ml-1">{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
