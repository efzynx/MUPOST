"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { useOnlineStatus } from "@/components/OfflineBanner";

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
  status: "DRAFT" | "SCHEDULED" | "QUEUED" | "PUBLISHED" | "PARTIAL" | "FAILED";
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

type StatusFilter = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED";
type PlatformFilter = "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";

// ==========================================
// Helpers
// ==========================================

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Terjadwal" },
  { value: "PUBLISHED", label: "Terpublikasi" },
  { value: "FAILED", label: "Gagal" },
];

const PLATFORM_OPTIONS: { value: PlatformFilter; label: string }[] = [
  { value: "META_PAGE", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "THREADS", label: "Threads" },
];

function getStatusBadge(status: PostItem["status"]) {
  const map: Record<
    PostItem["status"],
    {
      variant: "default" | "scheduled" | "published" | "failed" | "outline" | "secondary";
      label: string;
    }
  > = {
    DRAFT: { variant: "default", label: "Draft" },
    SCHEDULED: { variant: "scheduled", label: "Terjadwal" },
    QUEUED: { variant: "outline", label: "Antrean" },
    PUBLISHED: { variant: "published", label: "Terpublikasi" },
    PARTIAL: { variant: "scheduled", label: "Sebagian" },
    FAILED: { variant: "failed", label: "Gagal" },
  };
  const s = map[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={s.variant}>{s.label}</Badge>;
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

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, [statusFilters, platformFilters, page]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

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
      const res = await apiFetch(`/api/posts/${postId}/publish`, { method: "POST" });
      if (res.ok) loadPosts();
    } finally {
      setActionId(null);
      setActiveMenuId(null);
    }
  };

  const handleRetry = async (postId: string) => {
    setActionId(postId);
    try {
      const res = await apiFetch(`/api/posts/${postId}/retry`, { method: "POST" });
      if (res.ok) loadPosts();
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
      if (res.ok) loadPosts();
    } finally {
      setActionId(null);
      setActiveMenuId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Post</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Kelola konten yang akan dipublikasikan ke platform media sosial.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? "border-indigo-500/50 text-indigo-300" : ""}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            {hasActiveFilters && (
              <span className="ml-1 w-4 h-4 rounded-full bg-indigo-500 text-[10px] text-white flex items-center justify-center font-bold">
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
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!isOnline}
            title={!isOnline ? OFFLINE_TOOLTIP : undefined}
            onClick={() => router.push("/posts/new")}
          >
            <Plus className="w-3.5 h-3.5" />
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
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Filter</span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3" /> Hapus filter
                </button>
              )}
            </div>

            {/* Status filters */}
            <div>
              <span className="text-[11px] text-zinc-500 font-medium">Status</span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleStatus(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      statusFilters.includes(opt.value)
                        ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform filters */}
            <div>
              <span className="text-[11px] text-zinc-500 font-medium">Platform</span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {PLATFORM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => togglePlatform(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      platformFilters.includes(opt.value)
                        ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200"
                    }`}
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
          <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
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
              className="mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Buat Post Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card
              key={post.id}
              className={`border-zinc-800/80 bg-zinc-900/40 rounded-xl transition-all group ${
                isOnline ? "hover:border-zinc-700/80 cursor-pointer" : "cursor-default opacity-90"
              }`}
              title={!isOnline ? OFFLINE_TOOLTIP : undefined}
              onClick={() => {
                if (isOnline) {
                  router.push(`/posts/${post.id}/edit`);
                }
              }}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  {post.mediaUrls && post.mediaUrls.length > 0 ? (
                    <div className="shrink-0 w-14 h-14 rounded-lg bg-zinc-800 border border-zinc-700/50 overflow-hidden flex items-center justify-center">
                      {post.mediaUrls[0]?.match(/\.(mp4|mov|webm)$/i) ? (
                        <Video className="w-6 h-6 text-zinc-500" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-zinc-500" />
                      )}
                    </div>
                  ) : (
                    <div className="shrink-0 w-14 h-14 rounded-lg bg-zinc-800/50 border border-zinc-800 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-zinc-600" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(post.status)}
                      {/* Platform icons */}
                      <div className="flex items-center gap-1">
                        {Array.from(new Set(post.targets.map((t) => t.platform))).map((p) => (
                          <span
                            key={p}
                            className="opacity-60 group-hover:opacity-100 transition-opacity"
                          >
                            {getPlatformIcon(p, "w-3.5 h-3.5")}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="text-sm text-zinc-200 leading-relaxed">
                      {truncate(post.textContent)}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                      {post.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(post.scheduledAt)}
                        </span>
                      )}
                      {post.publishedAt && (
                        <span className="flex items-center gap-1 text-emerald-400/70">
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
                    </div>
                  </div>

                  {/* Actions menu */}
                  <div className="shrink-0 relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === post.id ? null : post.id)}
                      className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === post.id && (
                      <div className="absolute right-0 top-8 w-44 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/40 z-20 py-1.5 text-xs">
                        {(post.status === "DRAFT" || post.status === "SCHEDULED") && (
                          <button
                            onClick={() => handlePublish(post.id)}
                            disabled={actionId === post.id || !isOnline}
                            title={!isOnline ? OFFLINE_TOOLTIP : undefined}
                            className="w-full px-3.5 py-2 text-left hover:bg-zinc-800 text-zinc-200 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send className="w-3.5 h-3.5" /> Publikasikan
                          </button>
                        )}
                        {(post.status === "FAILED" || post.status === "PARTIAL") && (
                          <button
                            onClick={() => handleRetry(post.id)}
                            disabled={actionId === post.id || !isOnline}
                            title={!isOnline ? OFFLINE_TOOLTIP : undefined}
                            className="w-full px-3.5 py-2 text-left hover:bg-zinc-800 text-zinc-200 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Coba Lagi
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(post.id)}
                          disabled={actionId === post.id || !isOnline}
                          title={!isOnline ? OFFLINE_TOOLTIP : undefined}
                          className="w-full px-3.5 py-2 text-left hover:bg-zinc-800 text-zinc-200 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Copy className="w-3.5 h-3.5" /> Duplikasi
                        </button>
                        <div className="border-t border-zinc-800 my-1" />
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            setPostToDelete(post);
                          }}
                          disabled={actionId === post.id || !isOnline}
                          title={!isOnline ? OFFLINE_TOOLTIP : undefined}
                          className="w-full px-3.5 py-2 text-left hover:bg-red-950/40 text-red-400 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
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
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
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
