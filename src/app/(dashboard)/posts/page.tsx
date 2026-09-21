"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FacebookLogo,
  InstagramLogo,
  TikTokLogo,
  ThreadsLogo,
} from "@/components/ui/platform-icons";
import { DeletePostModal, type DeletePostApiResponse } from "@/components/posts/delete-post-modal";
import { formatDeleteFeedbackMessage } from "@/lib/services/post-delete-helpers";
import {
  Plus,
  Filter,
  FileText,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Send,
  Copy,
  RotateCcw,
  Image as ImageIcon,
  Video,
  MoreVertical,
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { useOnlineStatus } from "@/components/OfflineBanner";
import {
  usePostRealtime,
  useStatusTracker,
  type PostStatusEvent,
} from "@/lib/hooks/use-post-realtime";
import { LiveSyncIndicator, TransitionToastList } from "@/components/ui/live-sync-indicator";
import { cn } from "@/lib/utils";

// ==========================================
// Types
// ==========================================

interface PostTarget {
  id: string;
  connectedAccountId: string;
  platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
  status: string;
  platformPostId: string | null;
  publishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  accountName?: string;
}

interface PostItem {
  id: string;
  textContent: string;
  mediaUrls: string[] | null;
  status:
    "DRAFT" | "SCHEDULED" | "QUEUED" | "PUBLISHING" | "PUBLISHED" | "PARTIAL" | "FAILED" | string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  targets: PostTarget[];
}

interface ListResponse {
  data: {
    posts: PostItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

type StatusFilter = "DRAFT" | "SCHEDULED" | "QUEUED" | "PUBLISHED" | "FAILED";
type PlatformFilter = "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";

// ==========================================
// Helpers
// ==========================================

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "QUEUED", label: "Antrean" },
  { value: "SCHEDULED", label: "Terjadwal" },
  { value: "PUBLISHED", label: "Terpublikasi" },
  { value: "DRAFT", label: "Draft" },
  { value: "FAILED", label: "Gagal" },
];

const PLATFORM_OPTIONS: { value: PlatformFilter; label: string }[] = [
  { value: "META_PAGE", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "THREADS", label: "Threads" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="default">Draft</Badge>;
    case "SCHEDULED":
      return <Badge variant="scheduled">Terjadwal</Badge>;
    case "QUEUED":
      return (
        <Badge variant="queued" className="gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
          Antrean
        </Badge>
      );
    case "PUBLISHING":
      return (
        <Badge variant="publishing" className="gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
          Memproses
        </Badge>
      );
    case "PUBLISHED":
      return (
        <Badge variant="published" className="gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Terpublikasi
        </Badge>
      );
    case "PARTIAL":
      return <Badge variant="scheduled">Sebagian</Badge>;
    case "FAILED":
      return (
        <Badge variant="failed" className="gap-1.5">
          <AlertCircle className="w-3 h-3 text-red-400" />
          Gagal
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getPlatformIcon(platform: PostTarget["platform"], size = "w-4 h-4") {
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string, max = 100) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

// ==========================================
// Component
// ==========================================

function PostsListContent() {
  const router = useRouter();

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([]);
  const [platformFilters, setPlatformFilters] = useState<PlatformFilter[]>([]);

  const isOnline = useOnlineStatus();
  const OFFLINE_TOOLTIP = "Tidak tersedia saat offline";

  // Action states
  const [actionId, setActionId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<PostItem | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const isInitialLoadRef = useRef(true);

  const loadPosts = useCallback(
    async (silent = false) => {
      if (!silent && isInitialLoadRef.current) {
        setIsLoading(true);
      }
      try {
        const params = new URLSearchParams();
        if (statusFilters.length > 0) params.set("status", statusFilters.join(","));
        if (platformFilters.length > 0) params.set("platform", platformFilters.join(","));
        params.set("page", String(page));

        const res = await apiFetch<ListResponse["data"]>(`/api/posts?${params.toString()}`);
        if (res.ok && res.data) {
          const data = (res.data as unknown as ListResponse).data ?? res.data;
          setPosts(data.posts ?? []);
          setTotal(data.total ?? 0);
          setTotalPages(data.totalPages ?? 0);
        }
      } catch {
        // Fallback
      } finally {
        isInitialLoadRef.current = false;
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [statusFilters, platformFilters, page]
  );

  useEffect(() => {
    loadPosts(false);
  }, [loadPosts]);

  // Status transition tracking for real-time visual feedback
  const { transitioningIds, recentNotifications, dismissNotification } = useStatusTracker(posts);

  // Handle immediate state update from real-time events (SSE / PubSub)
  const handlePostStatusChange = useCallback(
    (event: PostStatusEvent) => {
      setPosts((prevPosts) => {
        const idx = prevPosts.findIndex((p) => p.id === event.postId);
        if (idx === -1) {
          // Jika post baru atau belum ada di list saat ini, pemicu re-fetch santai
          loadPosts(true);
          return prevPosts;
        }

        const updated = [...prevPosts];
        const existing = updated[idx];
        if (!existing) return prevPosts;

        updated[idx] = {
          ...existing,
          status: event.status,
          publishedAt: event.publishedAt ? String(event.publishedAt) : existing.publishedAt,
          scheduledAt: event.scheduledAt ? String(event.scheduledAt) : existing.scheduledAt,
          targets: event.targets
            ? existing.targets.map((target) => {
                const matchingTarget = event.targets?.find(
                  (t) => t.id === target.id || t.platform === target.platform
                );
                if (matchingTarget) {
                  return {
                    ...target,
                    status: matchingTarget.status,
                    errorCode: matchingTarget.errorCode ?? target.errorCode,
                    errorMessage: matchingTarget.errorMessage ?? target.errorMessage,
                    publishedAt: matchingTarget.publishedAt
                      ? String(matchingTarget.publishedAt)
                      : target.publishedAt,
                  };
                }
                return target;
              })
            : existing.targets,
        };
        return updated;
      });
    },
    [loadPosts]
  );

  // Check if any post is actively queued or publishing
  const hasActivePosts = posts.some(
    (p) =>
      p.status === "QUEUED" ||
      p.status === "PUBLISHING" ||
      p.targets.some((t) => t.status === "PENDING")
  );

  const { isRefreshing, lastUpdated, isLive, isSseConnected, connectionMode, refresh } =
    usePostRealtime({
      onStatusChange: handlePostStatusChange,
      onReconcile: () => loadPosts(true),
      hasActiveJobs: hasActivePosts,
      enabled: isOnline,
      activeInterval: 3000,
      idleInterval: 15000,
    });

  // Filter toggles
  const toggleStatus = (s: StatusFilter) => {
    setStatusFilters((prev) => (prev.includes(s) ? prev.filter((v) => v !== s) : [...prev, s]));
    setPage(1);
  };

  const togglePlatform = (p: PlatformFilter) => {
    setPlatformFilters((prev) => (prev.includes(p) ? prev.filter((v) => v !== p) : [...prev, p]));
    setPage(1);
  };

  const clearFilters = () => {
    setStatusFilters([]);
    setPlatformFilters([]);
    setPage(1);
  };

  const hasActiveFilters = statusFilters.length > 0 || platformFilters.length > 0;

  // Actions
  const handleDeleteSuccess = (result: DeletePostApiResponse, deletedPost: PostItem) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedPost.id));
    setTotal((prev) => Math.max(0, prev - 1));
    const feedbackMsg = formatDeleteFeedbackMessage({
      deleteOnPlatforms: Boolean(result.platformResults && result.platformResults.length > 0),
      platformResults: result.platformResults,
    });
    setFeedback(feedbackMsg);
  };

  const handlePublish = async (postId: string) => {
    if (!window.confirm("Publikasikan post ini sekarang?")) return;
    setActionId(postId);
    try {
      // Optimistic update status to QUEUED
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, status: "QUEUED" } : p)));
      const res = await apiFetch(`/api/posts/${postId}/publish`, { method: "POST" });
      if (res.ok) {
        await loadPosts(true);
      }
    } finally {
      setActionId(null);
      setActiveMenuId(null);
    }
  };

  const handleRetry = async (postId: string) => {
    setActionId(postId);
    try {
      // Optimistic update status to QUEUED
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, status: "QUEUED" } : p)));
      const res = await apiFetch(`/api/posts/${postId}/retry`, { method: "POST" });
      if (res.ok) {
        await loadPosts(true);
      }
    } finally {
      setActionId(null);
      setActiveMenuId(null);
    }
  };

  const handleDuplicate = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    setActionId(postId);
    try {
      const res = await apiFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          textContent: post.textContent,
          mediaUrls: post.mediaUrls,
          targetAccountIds: post.targets.map((t) => t.connectedAccountId),
        }),
      });
      if (res.ok) loadPosts(true);
    } finally {
      setActionId(null);
      setActiveMenuId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Status Notifications Toast */}
      <TransitionToastList notifications={recentNotifications} onDismiss={dismissNotification} />

      {/* Header */}
      <div className="flex flex-col gap-4 pb-5 border-b border-zinc-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">Post</h1>
            <p className="text-xs text-zinc-400 mt-0.5 sm:mt-1">
              Kelola konten yang akan dipublikasikan ke platform media sosial.
            </p>
          </div>

          <LiveSyncIndicator
            isLive={isLive}
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated}
            hasActiveJobs={hasActivePosts}
            isSseConnected={isSseConnected}
            connectionMode={connectionMode}
            onRefresh={refresh}
          />
        </div>

        {/* Action Buttons with Touch-Friendly Heights */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "min-h-[42px] px-3.5 text-xs touch-manipulation",
              hasActiveFilters ? "border-indigo-500/50 text-indigo-300" : ""
            )}
          >
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            Filter
            {hasActiveFilters && (
              <span className="ml-1.5 w-4 h-4 rounded-full bg-indigo-500 text-[10px] text-white flex items-center justify-center font-bold">
                {statusFilters.length + platformFilters.length}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!isOnline}
            title={!isOnline ? OFFLINE_TOOLTIP : undefined}
            onClick={() => router.push("/posts/import")}
            className="min-h-[42px] px-3.5 text-xs touch-manipulation"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Import CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={!isOnline}
            title={!isOnline ? OFFLINE_TOOLTIP : undefined}
            onClick={() => router.push("/posts/new")}
            className="min-h-[42px] px-4 text-xs ml-auto sm:ml-0 touch-manipulation shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Buat Post
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-xs ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : feedback.type === "info"
                ? "bg-indigo-950/40 border-indigo-800/60 text-indigo-300"
                : "bg-red-950/40 border-red-800/60 text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : feedback.type === "info" ? (
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 font-medium">{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-zinc-400 hover:text-zinc-200"
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <Card className="border-zinc-800 bg-zinc-900/50 rounded-xl">
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Filter Pencarian</span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-[36px] px-2 text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors touch-manipulation"
                >
                  <X className="w-3 h-3" /> Hapus filter
                </button>
              )}
            </div>

            {/* Status filters */}
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block mb-1.5">
                Status Post
              </span>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleStatus(opt.value)}
                    className={cn(
                      "min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-medium border transition-all touch-manipulation active:scale-95",
                      statusFilters.includes(opt.value)
                        ? "bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform filters */}
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block mb-1.5">
                Platform Media Sosial
              </span>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => togglePlatform(opt.value)}
                    className={cn(
                      "min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-medium border transition-all flex items-center gap-2 touch-manipulation active:scale-95",
                      platformFilters.includes(opt.value)
                        ? "bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200"
                    )}
                  >
                    {getPlatformIcon(opt.value, "w-3.5 h-3.5")}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post List */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-zinc-500">Memuat post...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <FileText className="w-10 h-10 mx-auto text-zinc-700" />
          <p className="text-sm font-medium text-zinc-300">
            {hasActiveFilters ? "Tidak ada post yang cocok dengan filter" : "Belum ada post"}
          </p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? "Coba ubah filter atau hapus semua filter."
              : "Buat post pertama Anda untuk mulai mempublikasikan konten."}
          </p>
          {!hasActiveFilters && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/posts/new")}
              className="mt-2 min-h-[42px] px-4 touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Buat Post Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const isTransitioning = transitioningIds.has(post.id);
            const transition = transitioningIds.get(post.id);
            const isJustPublished = transition?.newStatus === "PUBLISHED";
            const isJustFailed = transition?.newStatus === "FAILED";
            const isProcessing = post.status === "QUEUED" || post.status === "PUBLISHING";

            return (
              <Card
                key={post.id}
                className={cn(
                  "rounded-xl transition-all duration-500 group relative",
                  isTransitioning &&
                    isJustPublished &&
                    "ring-2 ring-emerald-500/80 bg-emerald-950/20 shadow-lg shadow-emerald-950/30 border-emerald-500/40",
                  isTransitioning &&
                    isJustFailed &&
                    "ring-2 ring-red-500/80 bg-red-950/20 shadow-lg shadow-red-950/30 border-red-500/40",
                  isTransitioning &&
                    !isJustPublished &&
                    !isJustFailed &&
                    "ring-2 ring-cyan-500/70 bg-cyan-950/20 shadow-lg shadow-cyan-950/30 border-cyan-500/40",
                  !isTransitioning &&
                    isProcessing &&
                    "border-indigo-800/80 bg-zinc-900/50 shadow-sm",
                  !isTransitioning && !isProcessing && "border-zinc-800/80 bg-zinc-900/40",
                  isOnline ? "hover:border-zinc-700/80 cursor-pointer" : "cursor-default opacity-90"
                )}
                title={!isOnline ? OFFLINE_TOOLTIP : undefined}
                onClick={() => {
                  if (isOnline) {
                    router.push(`/posts/${post.id}/edit`);
                  }
                }}
              >
                <CardContent className="p-3.5 sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Thumbnail */}
                    {post.mediaUrls && post.mediaUrls.length > 0 ? (
                      <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-zinc-800 border border-zinc-700/50 overflow-hidden flex items-center justify-center">
                        {post.mediaUrls[0]?.match(/\.(mp4|mov|webm)$/i) ? (
                          <Video className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-500" />
                        ) : (
                          <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-500" />
                        )}
                      </div>
                    ) : (
                      <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-zinc-800/50 border border-zinc-800 flex items-center justify-center">
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-600" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(post.status)}

                        {/* Real-time transition highlight tag */}
                        {isTransitioning && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse">
                            Status Terbarui &rarr; {transition?.newStatus}
                          </span>
                        )}

                        {/* Platform icons */}
                        <div className="flex items-center gap-1 ml-auto sm:ml-0">
                          {Array.from(new Set(post.targets.map((t) => t.platform))).map((p) => (
                            <span
                              key={p}
                              className="opacity-70 group-hover:opacity-100 transition-opacity"
                              title={p}
                            >
                              {getPlatformIcon(p, "w-3.5 h-3.5")}
                            </span>
                          ))}
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-normal">
                        {truncate(post.textContent, 120)}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                        {post.scheduledAt && (
                          <span className="flex items-center gap-1 text-amber-400/90 font-medium">
                            <Calendar className="w-3 h-3" />
                            {formatDate(post.scheduledAt)}
                          </span>
                        )}
                        {post.publishedAt && (
                          <span className="flex items-center gap-1 text-emerald-400/90 font-medium">
                            <Clock className="w-3 h-3" />
                            {formatDate(post.publishedAt)}
                          </span>
                        )}
                        {!post.scheduledAt && !post.publishedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(post.createdAt)}
                          </span>
                        )}

                        {/* Mobile quick action for FAILED / PARTIAL posts */}
                        {(post.status === "FAILED" || post.status === "PARTIAL") && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(post.id);
                            }}
                            disabled={actionId === post.id || !isOnline}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 py-1 px-2 rounded bg-amber-950/40 border border-amber-800/40 active:scale-95 transition-all touch-manipulation"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Coba Lagi
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actions menu with Touch-friendly hit target */}
                    <div className="shrink-0 relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label="Opsi postingan"
                        onClick={() => setActiveMenuId(activeMenuId === post.id ? null : post.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 active:bg-zinc-700/80 transition-colors touch-manipulation"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === post.id && (
                        <>
                          {/* Mobile Backdrop for safe touch closing */}
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setActiveMenuId(null)}
                          />

                          <div className="absolute right-0 top-11 w-48 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60 z-30 py-1.5 text-xs animate-in fade-in zoom-in-95">
                            {(post.status === "DRAFT" || post.status === "SCHEDULED") && (
                              <button
                                type="button"
                                onClick={() => handlePublish(post.id)}
                                disabled={actionId === post.id || !isOnline}
                                title={!isOnline ? OFFLINE_TOOLTIP : undefined}
                                className="w-full min-h-[44px] px-4 py-2 text-left hover:bg-zinc-800 active:bg-zinc-700 text-zinc-200 flex items-center gap-2.5 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Send className="w-3.5 h-3.5 text-indigo-400" /> Publikasikan
                              </button>
                            )}
                            {(post.status === "FAILED" || post.status === "PARTIAL") && (
                              <button
                                type="button"
                                onClick={() => handleRetry(post.id)}
                                disabled={actionId === post.id || !isOnline}
                                title={!isOnline ? OFFLINE_TOOLTIP : undefined}
                                className="w-full min-h-[44px] px-4 py-2 text-left hover:bg-zinc-800 active:bg-zinc-700 text-zinc-200 flex items-center gap-2.5 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Coba Lagi
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDuplicate(post.id)}
                              disabled={actionId === post.id || !isOnline}
                              title={!isOnline ? OFFLINE_TOOLTIP : undefined}
                              className="w-full min-h-[44px] px-4 py-2 text-left hover:bg-zinc-800 active:bg-zinc-700 text-zinc-200 flex items-center gap-2.5 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Copy className="w-3.5 h-3.5 text-zinc-400" /> Duplikasi
                            </button>
                            <div className="border-t border-zinc-800 my-1" />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setPostToDelete(post);
                              }}
                              disabled={actionId === post.id || !isOnline}
                              title={!isOnline ? OFFLINE_TOOLTIP : undefined}
                              className="w-full min-h-[44px] px-4 py-2 text-left hover:bg-red-950/50 active:bg-red-900/60 text-red-400 flex items-center gap-2.5 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination with Touch-friendly buttons */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
              <p className="text-xs text-zinc-500">
                {total} post · Halaman {page} dari {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="min-h-[44px] min-w-[44px] p-0 touch-manipulation"
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="min-h-[44px] min-w-[44px] p-0 touch-manipulation"
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Konfirmasi Hapus Postingan */}
      <DeletePostModal
        isOpen={Boolean(postToDelete)}
        onClose={() => setPostToDelete(null)}
        post={postToDelete}
        onSuccess={(result, deletedPost) => {
          handleDeleteSuccess(result, deletedPost as PostItem);
        }}
      />
    </div>
  );
}

export default function PostsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-12 text-center text-xs text-zinc-500">
          <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Memuat post...
        </div>
      }
    >
      <PostsListContent />
    </React.Suspense>
  );
}
