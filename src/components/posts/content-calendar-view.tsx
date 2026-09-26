"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getMonthDays,
  getWeekDays,
  getNextMonth,
  getPrevMonth,
  getNextWeek,
  getPrevWeek,
  formatMonthYear,
  formatWeekRange,
  formatTime,
  INDONESIAN_DAYS_SHORT,
  INDONESIAN_DAYS_FULL,
  type CalendarPostItem,
  type CalendarDay,
} from "@/lib/calendar-utils";
import {
  FacebookLogo,
  InstagramLogo,
  TikTokLogo,
  ThreadsLogo,
} from "@/components/ui/platform-icons";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  ExternalLink,
  X,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentCalendarViewProps {
  posts: CalendarPostItem[];
  isLoading?: boolean;
  onPostClick?: (post: CalendarPostItem) => void;
  onRetryPost?: (postId: string) => void;
  onPublishPost?: (postId: string) => void;
  isOnline?: boolean;
}

function getPlatformIcon(platform: string, size = "w-3.5 h-3.5") {
  switch (platform) {
    case "META_PAGE":
      return <FacebookLogo className={size} />;
    case "INSTAGRAM":
      return <InstagramLogo className={size} />;
    case "TIKTOK":
      return <TikTokLogo className={size} />;
    case "THREADS":
      return <ThreadsLogo className={size} />;
    default:
      return null;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Draft
        </span>
      );
    case "SCHEDULED":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/40 dark:border-amber-700/50">
          Terjadwal
        </span>
      );
    case "QUEUED":
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Antrean
        </span>
      );
    case "PUBLISHING":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300">
          Memproses
        </span>
      );
    case "PUBLISHED":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
          Terpublikasi
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300">
          Gagal
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {status}
        </span>
      );
  }
}

export function ContentCalendarView({
  posts,
  isLoading = false,
  onPostClick,
  onRetryPost,
  onPublishPost,
  isOnline = true,
}: ContentCalendarViewProps) {
  const router = useRouter();

  // Mode: "month" | "week"
  const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");
  // Tanggal acuan navigasi kalender
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  // Tanggal yang dipilih untuk melihat detail di mobile atau klik modal
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  // Matriks kalender bulanan dan mingguan
  const monthDays = useMemo(() => getMonthDays(currentDate, posts), [currentDate, posts]);
  const weekDays = useMemo(() => getWeekDays(currentDate, posts), [currentDate, posts]);

  // Navigasi periode
  const handlePrev = () => {
    if (calendarMode === "month") {
      setCurrentDate((prev) => getPrevMonth(prev));
    } else {
      setCurrentDate((prev) => getPrevWeek(prev));
    }
  };

  const handleNext = () => {
    if (calendarMode === "month") {
      setCurrentDate((prev) => getNextMonth(prev));
    } else {
      setCurrentDate((prev) => getNextWeek(prev));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Header Title
  const periodTitle = useMemo(() => {
    if (calendarMode === "month") {
      return formatMonthYear(currentDate);
    }
    const start = weekDays[0]?.date ?? currentDate;
    const end = weekDays[6]?.date ?? currentDate;
    return formatWeekRange(start, end);
  }, [calendarMode, currentDate, weekDays]);

  const handleSelectPost = (post: CalendarPostItem) => {
    if (onPostClick) {
      onPostClick(post);
    } else {
      router.push(`/posts/${post.id}/edit`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
        {/* Navigation & Title */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              className="h-9 w-9 p-0 rounded-lg touch-manipulation"
              aria-label="Periode sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              className="h-9 w-9 p-0 rounded-lg touch-manipulation"
              aria-label="Periode berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="h-9 px-3 text-xs font-medium rounded-lg touch-manipulation"
          >
            Hari Ini
          </Button>

          <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 ml-1">
            {periodTitle}
          </h2>
        </div>

        {/* View Switcher: Bulanan vs Mingguan */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/70">
            <button
              type="button"
              onClick={() => setCalendarMode("month")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all touch-manipulation",
                calendarMode === "month"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              Bulanan
            </button>
            <button
              type="button"
              onClick={() => setCalendarMode("week")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all touch-manipulation",
                calendarMode === "week"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              Mingguan
            </button>
          </div>
        </div>
      </div>

      {/* Main Calendar Viewport */}
      {calendarMode === "month" ? (
        <MonthCalendarGrid
          days={monthDays}
          isLoading={isLoading}
          onSelectPost={handleSelectPost}
          onDayClick={(day) => setSelectedDay(day)}
        />
      ) : (
        <WeekCalendarGrid
          days={weekDays}
          isLoading={isLoading}
          onSelectPost={handleSelectPost}
          onRetryPost={onRetryPost}
          onPublishPost={onPublishPost}
          isOnline={isOnline}
        />
      )}

      {/* Selected Day Modal / Sheet (terutama berguna pada mobile & saat banyak post) */}
      {selectedDay && (
        <DayDetailModal
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
          onSelectPost={handleSelectPost}
        />
      )}
    </div>
  );
}

// ==========================================
// Month Grid Component
// ==========================================

interface MonthCalendarGridProps {
  days: CalendarDay[];
  isLoading: boolean;
  onSelectPost: (post: CalendarPostItem) => void;
  onDayClick: (day: CalendarDay) => void;
}

function MonthCalendarGrid({
  days,
  isLoading: _isLoading,
  onSelectPost,
  onDayClick,
}: MonthCalendarGridProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-sm">
      {/* Weekday Labels Header (Sen s/d Min) */}
      <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 text-center">
        {INDONESIAN_DAYS_SHORT.map((dayName, idx) => (
          <div
            key={dayName}
            className={cn(
              "py-2.5 text-xs font-semibold uppercase tracking-wider",
              idx >= 5 ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-600 dark:text-zinc-300"
            )}
          >
            <span className="hidden sm:inline">{INDONESIAN_DAYS_FULL[idx]}</span>
            <span className="sm:hidden">{dayName}</span>
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-zinc-200 dark:divide-zinc-800/80">
        {days.map((day) => {
          const hasPosts = day.posts.length > 0;
          return (
            <div
              key={day.dateString}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-[90px] sm:min-h-[120px] p-1.5 sm:p-2 flex flex-col transition-colors cursor-pointer group",
                day.isCurrentMonth
                  ? "bg-white dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  : "bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50",
                day.isToday &&
                  "ring-1 ring-inset ring-indigo-500/50 bg-indigo-50/30 dark:bg-indigo-950/15"
              )}
            >
              {/* Day Number Bar */}
              <div className="flex items-center justify-between gap-1 mb-1">
                <span
                  className={cn(
                    "text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                    day.isToday
                      ? "bg-indigo-600 text-white font-bold shadow-sm"
                      : day.isCurrentMonth
                        ? "text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                        : "text-zinc-400 dark:text-zinc-600"
                  )}
                >
                  {day.dayNumber}
                </span>

                {hasPosts && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
                    {day.posts.length}
                  </span>
                )}
              </div>

              {/* Day's Posts Mini List */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {day.posts.slice(0, 2).map((post) => {
                  const targetPlatforms = Array.from(new Set(post.targets.map((t) => t.platform)));
                  return (
                    <div
                      key={post.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPost(post);
                      }}
                      className="p-1 sm:p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-zinc-200 dark:border-zinc-700/60 text-left transition-all group/item shadow-xs"
                      title={post.textContent}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTime(post.scheduledAt || post.publishedAt || post.createdAt)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {targetPlatforms.map((p) => (
                            <span key={p} className="opacity-80">
                              {getPlatformIcon(p, "w-2.5 h-2.5")}
                            </span>
                          ))}
                        </div>
                      </div>

                      <p className="text-[10px] sm:text-[11px] text-zinc-800 dark:text-zinc-200 truncate leading-snug font-normal">
                        {post.textContent || "(Tanpa teks)"}
                      </p>
                    </div>
                  );
                })}

                {/* More posts badge */}
                {day.posts.length > 2 && (
                  <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 text-center py-0.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded">
                    +{day.posts.length - 2} lainnya
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// Week Grid Component
// ==========================================

interface WeekCalendarGridProps {
  days: CalendarDay[];
  isLoading: boolean;
  onSelectPost: (post: CalendarPostItem) => void;
  onRetryPost?: (postId: string) => void;
  onPublishPost?: (postId: string) => void;
  isOnline: boolean;
}

function WeekCalendarGrid({
  days,
  isLoading: _isLoading,
  onSelectPost,
  onRetryPost,
  onPublishPost: _onPublishPost,
  isOnline,
}: WeekCalendarGridProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
      {days.map((day, idx) => {
        return (
          <div
            key={day.dateString}
            className={cn(
              "flex flex-col rounded-xl border transition-all overflow-hidden",
              day.isToday
                ? "border-indigo-500/60 bg-indigo-50/15 dark:bg-indigo-950/10 shadow-sm"
                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40"
            )}
          >
            {/* Column Header */}
            <div
              className={cn(
                "p-3 border-b flex items-center justify-between",
                day.isToday
                  ? "border-indigo-200 dark:border-indigo-900/60 bg-indigo-100/50 dark:bg-indigo-950/40"
                  : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70"
              )}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {INDONESIAN_DAYS_FULL[idx]}
                </p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {day.dayNumber}{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    {day.date.toLocaleDateString("id-ID", { month: "short" })}
                  </span>
                </p>
              </div>

              {day.isToday && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs">
                  Hari Ini
                </span>
              )}
            </div>

            {/* Post cards list in that day */}
            <div className="p-2 sm:p-2.5 flex-1 space-y-2 min-h-[160px]">
              {day.posts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-6 text-center text-zinc-400 dark:text-zinc-600">
                  <p className="text-xs">Tidak ada jadwal</p>
                  <button
                    type="button"
                    onClick={() => router.push("/posts/new")}
                    className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 touch-manipulation"
                  >
                    <Plus className="w-3 h-3" /> Tambah Post
                  </button>
                </div>
              ) : (
                day.posts.map((post) => {
                  const targetPlatforms = Array.from(new Set(post.targets.map((t) => t.platform)));
                  return (
                    <div
                      key={post.id}
                      onClick={() => onSelectPost(post)}
                      className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/50 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/80 transition-all cursor-pointer space-y-2 shadow-xs"
                    >
                      {/* Top: Status & Time */}
                      <div className="flex items-center justify-between gap-1">
                        {getStatusBadge(post.status)}
                        <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(post.scheduledAt || post.publishedAt || post.createdAt)}
                        </span>
                      </div>

                      {/* Content Preview */}
                      <p className="text-xs text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-relaxed">
                        {post.textContent || "(Tanpa teks)"}
                      </p>

                      {/* Platforms */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-zinc-700/50">
                        <div className="flex items-center gap-1.5">
                          {targetPlatforms.map((p) => (
                            <span key={p} title={p}>
                              {getPlatformIcon(p, "w-3.5 h-3.5")}
                            </span>
                          ))}
                        </div>

                        {/* Quick retry if failed */}
                        {post.status === "FAILED" && onRetryPost && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRetryPost(post.id);
                            }}
                            disabled={!isOnline}
                            className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> Retry
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// Day Detail Modal / Sheet
// ==========================================

interface DayDetailModalProps {
  day: CalendarDay;
  onClose: () => void;
  onSelectPost: (post: CalendarPostItem) => void;
}

function DayDetailModal({ day, onClose, onSelectPost }: DayDetailModalProps) {
  const router = useRouter();

  const formattedDate = day.date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Jadwal Konten: {formattedDate}
            </h3>
            <p className="text-xs text-zinc-500">
              {day.posts.length} postingan tercatat pada tanggal ini.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post items list */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {day.posts.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs space-y-3">
              <CalendarIcon className="w-8 h-8 mx-auto text-zinc-400 opacity-60" />
              <p>Belum ada postingan yang dijadwalkan pada tanggal ini.</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  router.push("/posts/new");
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Buat Post Baru
              </Button>
            </div>
          ) : (
            day.posts.map((post) => {
              const targetPlatforms = Array.from(new Set(post.targets.map((t) => t.platform)));
              return (
                <div
                  key={post.id}
                  onClick={() => {
                    onClose();
                    onSelectPost(post);
                  }}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 hover:border-indigo-500/60 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(post.status)}
                      <span className="text-xs font-mono text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(post.scheduledAt || post.publishedAt || post.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {targetPlatforms.map((p) => (
                        <span key={p} title={p}>
                          {getPlatformIcon(p, "w-4 h-4")}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal">
                    {post.textContent}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700/40 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    <span>Klik untuk mengedit postingan</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onClose();
              router.push("/posts/new");
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Buat Post
          </Button>
        </div>
      </div>
    </div>
  );
}
