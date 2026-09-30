"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { invalidatePostsCache } from "@/lib/pwa-cache";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FacebookLogo,
  InstagramLogo,
  TikTokLogo,
  ThreadsLogo,
} from "@/components/ui/platform-icons";
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Calendar,
  FileText,
  X,
  Clock,
  Layers,
  Info,
} from "lucide-react";
import {
  hasPublishedTargets,
  getPublishedTargets,
  formatPlatformDisplayName,
  isPlatformDeleteSupported,
  type DeleteTargetInfo,
  type PlatformDeleteResultSummary,
} from "@/lib/services/post-delete-helpers";

export interface PostToDelete {
  id: string;
  textContent: string;
  mediaUrls?: string[] | null;
  status: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  targets?: DeleteTargetInfo[];
}

export interface DeletePostApiResponse {
  success: boolean;
  deletedPostId?: string;
  platformResults?: PlatformDeleteResultSummary[];
  error?: {
    code: string;
    message: string;
  };
}

export interface DeletePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: PostToDelete | null;
  onSuccess?: (result: DeletePostApiResponse, post: PostToDelete) => void;
  /**
   * Opsional: kustom handler penghapusan jika ingin dioverride oleh pemanggil.
   */
  onDelete?: (postId: string, deleteOnPlatforms: boolean) => Promise<DeletePostApiResponse | void>;
}

function getPlatformIcon(platform: string, size = "w-4 h-4") {
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
      return <Layers className={size} />;
  }
}

function getStatusBadge(status: string) {
  const map: Record<
    string,
    { variant: "default" | "scheduled" | "published" | "failed" | "outline"; label: string }
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

export function DeletePostModal({
  isOpen,
  onClose,
  post,
  onSuccess,
  onDelete,
}: DeletePostModalProps) {
  const isPostPublished = Boolean(post && hasPublishedTargets(post));
  const publishedTargets = post ? getPublishedTargets(post) : [];
  const displayTargets =
    publishedTargets.length > 0
      ? publishedTargets
      : post?.status === "PUBLISHED" && post.targets
        ? post.targets
        : [];

  const hasUnsupportedPlatforms = displayTargets.some(
    (t) => !isPlatformDeleteSupported(t.platform)
  );
  const unsupportedPlatformNames = Array.from(
    new Set(
      displayTargets
        .filter((t) => !isPlatformDeleteSupported(t.platform))
        .map((t) => formatPlatformDisplayName(t.platform))
    )
  );

  const [deleteOnPlatforms, setDeleteOnPlatforms] = useState<boolean>(isPostPublished);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sinkronisasi status awal checkbox saat modal dibuka atau post berubah
  useEffect(() => {
    if (isOpen && post) {
      setDeleteOnPlatforms(isPostPublished);
      setErrorMessage(null);
      setIsDeleting(false);
    }
  }, [isOpen, post, isPostPublished]);

  // Tangani tombol ESC untuk menutup dialog
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onClose();
      }
    },
    [isDeleting, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !post) return null;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      let result: DeletePostApiResponse;

      if (onDelete) {
        const customRes = await onDelete(post.id, deleteOnPlatforms);
        result = (customRes as DeletePostApiResponse) || {
          success: true,
          deletedPostId: post.id,
        };
      } else {
        const query = `?deleteOnPlatforms=${deleteOnPlatforms}`;
        const res = await apiFetch<DeletePostApiResponse>(`/api/posts/${post.id}${query}`, {
          method: "DELETE",
          body: JSON.stringify({ deleteOnPlatforms }),
        });

        if (!res.ok) {
          const resError = res.data?.error?.message || "Gagal menghapus postingan.";
          throw new Error(resError);
        }

        result = res.data || { success: true, deletedPostId: post.id };
      }

      await invalidatePostsCache();

      if (onSuccess) {
        onSuccess(result, post);
      }
      onClose();
    } catch (err: unknown) {
      const errorObj = err as Error;
      setErrorMessage(errorObj.message || "Terjadi kesalahan saat menghapus postingan.");
    } finally {
      setIsDeleting(false);
    }
  };

  const truncatedContent =
    post.textContent.length > 120
      ? post.textContent.slice(0, 120) + "..."
      : post.textContent || "(Tanpa teks)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-post-dialog-title"
      aria-describedby="delete-post-dialog-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md my-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header Modal */}
        <div className="flex items-start justify-between p-5 pb-4 border-b border-zinc-200 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="delete-post-dialog-title"
                className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Hapus Postingan
              </h2>
              <p
                id="delete-post-dialog-desc"
                className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5"
              >
                Konfirmasi penghapusan konten postingan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 touch-manipulation"
            aria-label="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Konten Modal Scrollable */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Ringkasan Postingan yang akan dihapus */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {getStatusBadge(post.status)}
                {post.targets && post.targets.length > 0 && (
                  <div className="flex items-center gap-1 opacity-80">
                    {Array.from(new Set(post.targets.map((t) => t.platform))).map((p) => (
                      <span key={p} title={formatPlatformDisplayName(p)}>
                        {getPlatformIcon(p, "w-3.5 h-3.5")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {post.scheduledAt && (
                <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400/80">
                  <Clock className="w-3 h-3" />
                  Terjadwal
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed italic line-clamp-3">
              &ldquo;{truncatedContent}&rdquo;
            </p>
          </div>

          {/* Opsi & Penjelasan Sinkronisasi Platform */}
          {isPostPublished ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-4 space-y-3.5">
              <label className="flex items-start gap-3 cursor-pointer group select-none min-h-[44px] py-1 -my-1">
                <input
                  type="checkbox"
                  id="delete-on-platforms-checkbox"
                  checked={deleteOnPlatforms}
                  onChange={(e) => setDeleteOnPlatforms(e.target.checked)}
                  disabled={isDeleting}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-red-600 focus:ring-red-500 focus:ring-offset-white dark:focus:ring-offset-zinc-950 accent-red-600 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors block">
                    Hapus juga postingan di platform media sosial tujuan
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Konten yang sudah terbit di akun media sosial terhubung akan ikut dihapus secara
                    otomatis melalui API platform masing-masing.
                  </p>
                </div>
              </label>

              {/* Daftar platform yang terpengaruh dan visualisasi kapabilitas */}
              {displayTargets.length > 0 && (
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                    Platform Terbit yang Terpengaruh:
                  </span>
                  <div className="space-y-1.5">
                    {displayTargets.map((t, idx) => {
                      const isSupported = isPlatformDeleteSupported(t.platform);
                      return (
                        <div
                          key={t.id || `${t.platform}-${idx}`}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] shadow-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="shrink-0">
                              {getPlatformIcon(t.platform, "w-3.5 h-3.5")}
                            </div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
                              {t.accountName || formatPlatformDisplayName(t.platform)}
                            </span>
                          </div>
                          {isSupported ? (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/50">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              Hapus Otomatis
                            </span>
                          ) : (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/50">
                              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              Hapus Manual
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Catatan informatif kebijakan API platform (Instagram & TikTok) */}
                  {hasUnsupportedPlatforms && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/30 text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span>
                        <strong>
                          Catatan Kebijakan API ({unsupportedPlatformNames.join(", ")}):
                        </strong>{" "}
                        Instagram dan TikTok tidak mengizinkan remote delete dari pihak ketiga.
                        Postingan di platform ini perlu dihapus langsung dari aplikasinya.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Indikator Peringatan / Status Opsi */}
              {deleteOnPlatforms ? (
                <div className="flex items-start gap-2 text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg p-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Sinkronisasi aktif: Postingan akan dibersihkan dari Mupost dan dihapus dari akun
                    media sosial yang mendukung (Facebook &amp; Threads).
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>
                    Perhatian: Postingan hanya akan dihapus dari Mupost. Konten yang telah terbit
                    akan <strong>tetap tayang</strong> di media sosial.
                  </span>
                </div>
              )}
            </div>
          ) : post.status === "SCHEDULED" ? (
            <div className="flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 p-3.5 text-xs text-zinc-600 dark:text-zinc-400">
              <Calendar className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-zinc-900 dark:text-zinc-200 font-medium">
                  Postingan Belum Terbit (Terjadwal)
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Postingan ini belum dipublikasikan ke media sosial luar. Menghapus post ini akan
                  membatalkan antrean publikasi otomatis dan menghapus data dari Mupost.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 p-3.5 text-xs text-zinc-600 dark:text-zinc-400">
              <FileText className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-zinc-900 dark:text-zinc-200 font-medium">
                  Postingan {getStatusBadge(post.status)}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Postingan ini belum terbit di platform media sosial manapun dan hanya akan dihapus
                  dari basis data Mupost.
                </p>
              </div>
            </div>
          )}

          {/* Banner Pesan Error */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400 mt-0.5" />
              <span className="flex-1 leading-relaxed">{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 p-4 bg-zinc-50 dark:bg-zinc-950/40 border-t border-zinc-200 dark:border-zinc-800/80 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="min-h-[44px] px-4 text-xs touch-manipulation"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirmDelete}
            isLoading={isDeleting}
            disabled={isDeleting}
            className="min-h-[44px] px-4 text-xs gap-1.5 touch-manipulation"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? "Menghapus..." : "Hapus Postingan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DeletePostModal;
