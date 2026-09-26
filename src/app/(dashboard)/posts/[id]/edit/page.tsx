"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import dynamic from "next/dynamic";
import { PreviewPanelSkeleton } from "@/components/preview/PreviewSkeleton";
import type { SupportedPlatform } from "@/components/preview/PreviewPanel";
import { compressImage, isCompressibleImage } from "@/lib/image-compressor";
import { invalidatePostsCache } from "@/lib/pwa-cache";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  FacebookLogo,
  InstagramLogo,
  TikTokLogo,
  ThreadsLogo,
} from "@/components/ui/platform-icons";
import {
  ArrowLeft,
  Save,
  Send,
  Calendar,
  Upload,
  X,
  Image as ImageIcon,
  Video,
  AlertCircle,
  CheckCircle2,
  Copy,
  RotateCcw,
  Trash2,
} from "lucide-react";

// ==========================================
// Types
// ==========================================

interface ConnectedAccount {
  id: string;
  platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
  accountName: string;
  status: string;
}

interface PostTarget {
  id: string;
  connectedAccountId: string;
  platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  accountName?: string;
  platformPostId?: string | null;
}

interface PostData {
  id: string;
  textContent: string;
  mediaUrls: string[] | null;
  status: "DRAFT" | "SCHEDULED" | "QUEUED" | "PUBLISHED" | "PARTIAL" | "FAILED";
  scheduledAt: string | null;
  publishedAt: string | null;
  retryCount: number;
  createdAt: string;
  targets: PostTarget[];
}

// ==========================================
// Dynamic Components
// ==========================================

const PreviewPanel = dynamic(
  () => import("@/components/preview/PreviewPanel").then((mod) => mod.PreviewPanel),
  {
    loading: () => <PreviewPanelSkeleton />,
    ssr: false,
  }
);

const DeletePostModal = dynamic(
  () => import("@/components/posts/delete-post-modal").then((mod) => mod.DeletePostModal),
  {
    ssr: false,
  }
);

// ==========================================
// Component
// ==========================================

export default function EditPostPage() {
  const routeParams = useParams();
  const postId = (routeParams?.id as string) || "";
  const router = useRouter();

  // Form state
  const [textContent, setTextContent] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [useSchedule, setUseSchedule] = useState(false);

  // Data
  const [post, setPost] = useState<PostData | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionMessage, setCompressionMessage] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const MAX_TEXT = 5000;

  const isEditable = post?.status === "DRAFT" || post?.status === "SCHEDULED";

  // Load post and accounts
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [postRes, accRes] = await Promise.all([
        apiFetch<{ data: PostData }>(`/api/posts/${postId}`),
        apiFetch<{ data: ConnectedAccount[] }>("/api/connect/accounts"),
      ]);

      if (postRes.ok && postRes.data?.data) {
        const p = postRes.data.data;
        setPost(p);
        setTextContent(p.textContent);
        setMediaUrls(p.mediaUrls ?? []);
        setSelectedAccounts(p.targets.map((t) => t.connectedAccountId));
        if (p.scheduledAt) {
          setUseSchedule(true);
          setScheduledAt(new Date(p.scheduledAt).toISOString().slice(0, 16));
        }
      }

      if (accRes.ok && Array.isArray(accRes.data?.data)) {
        setAccounts(accRes.data.data.filter((a) => a.status === "ACTIVE"));
      }
    } catch {
      setFeedback({ type: "error", message: "Gagal memuat data post." });
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Account toggle
  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  // Media upload & compression
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let fileToUpload = file;

      // Otomatis kompresi gambar sebelum dikirim ke endpoint /api/media/upload
      if (isCompressibleImage(file)) {
        setIsCompressing(true);
        setCompressionProgress(10);
        const originalMb = (file.size / (1024 * 1024)).toFixed(1);
        setCompressionMessage(`Mengompresi gambar (${originalMb} MB)...`);

        fileToUpload = await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
          onProgress: (p) => setCompressionProgress(p),
        });

        setCompressionProgress(100);
      }

      setIsCompressing(false);
      setIsUploading(true);

      const formData = new FormData();
      formData.append("file", fileToUpload);

      const res = await apiFetch<{ url: string }>("/api/media/upload", {
        method: "POST",
        body: formData,
        headers: {},
      });

      if (res.ok && res.data?.url) {
        setMediaUrls((prev) => [...prev, res.data.url]);
      } else {
        const errData = res.data as unknown as { error?: { message?: string } };
        setFeedback({
          type: "error",
          message: errData?.error?.message ?? "Gagal mengupload file.",
        });
      }
    } catch {
      setFeedback({ type: "error", message: "Gagal mengupload file." });
    } finally {
      setIsCompressing(false);
      setIsUploading(false);
      setCompressionProgress(0);
      setCompressionMessage("");
      e.target.value = "";
    }
  };

  const removeMedia = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // Validation
  const canSave = textContent.trim().length > 0 && selectedAccounts.length > 0;
  const textOverLimit = textContent.length > MAX_TEXT;

  // Save
  const handleSave = async () => {
    if (!canSave || textOverLimit || !isEditable) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await apiFetch(`/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({
          textContent,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : [],
          targetAccountIds: selectedAccounts,
          scheduledAt: useSchedule && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      });

      if (res.ok) {
        await invalidatePostsCache();
        setFeedback({ type: "success", message: "Post berhasil disimpan." });
        loadData();
      } else {
        const errData = res.data as unknown as { error?: { message?: string } };
        setFeedback({ type: "error", message: errData?.error?.message ?? "Gagal menyimpan." });
      }
    } catch {
      setFeedback({ type: "error", message: "Gagal menyimpan post." });
    } finally {
      setIsSaving(false);
    }
  };

  // Publish now
  const handlePublishNow = async () => {
    if (!window.confirm("Publikasikan post ini sekarang?")) return;
    setIsPublishing(true);
    setFeedback(null);

    try {
      const res = await apiFetch(`/api/posts/${postId}/publish`, { method: "POST" });
      if (res.ok) {
        await invalidatePostsCache();
        router.push("/posts");
      } else {
        const errData = res.data as unknown as { error?: { message?: string } };
        setFeedback({
          type: "error",
          message: errData?.error?.message ?? "Gagal mempublikasikan.",
        });
      }
    } catch {
      setFeedback({ type: "error", message: "Gagal mempublikasikan post." });
    } finally {
      setIsPublishing(false);
    }
  };

  // Retry
  const handleRetry = async () => {
    try {
      const res = await apiFetch(`/api/posts/${postId}/retry`, { method: "POST" });
      if (res.ok) {
        await invalidatePostsCache();
        setFeedback({ type: "success", message: "Post dijadwalkan untuk retry." });
        loadData();
      } else {
        const errData = res.data as unknown as { error?: { message?: string } };
        setFeedback({ type: "error", message: errData?.error?.message ?? "Gagal retry." });
      }
    } catch {
      setFeedback({ type: "error", message: "Gagal retry." });
    }
  };

  // Duplicate
  const handleDuplicate = async () => {
    try {
      const res = await apiFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          textContent,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
          targetAccountIds: selectedAccounts,
        }),
      });
      if (res.ok) {
        await invalidatePostsCache();
        setFeedback({ type: "success", message: "Post diduplikasi sebagai draft." });
        const data = res.data as unknown as { data?: { id?: string } };
        if (data?.data?.id) {
          router.push(`/posts/${data.data.id}/edit`);
        }
      }
    } catch {
      setFeedback({ type: "error", message: "Gagal menduplikasi post." });
    }
  };

  // Delete
  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const getPlatformIcon = (platform: ConnectedAccount["platform"]) => {
    switch (platform) {
      case "META_PAGE":
        return <FacebookLogo className="w-5 h-5" />;
      case "INSTAGRAM":
        return <InstagramLogo className="w-5 h-5" />;
      case "TIKTOK":
        return <TikTokLogo className="w-5 h-5" />;
      case "THREADS":
        return <ThreadsLogo className="w-5 h-5" />;
    }
  };

  const getStatusBadge = (status: PostData["status"]) => {
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
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-zinc-500">Memuat post...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-20 text-center space-y-3">
        <AlertCircle className="w-10 h-10 mx-auto text-zinc-600" />
        <p className="text-sm text-zinc-300">Post tidak ditemukan.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/posts")}>
          Kembali ke Daftar Post
        </Button>
      </div>
    );
  }

  const selectedPlatforms = Array.from(
    new Set(
      accounts
        .filter((a) => selectedAccounts.includes(a.id))
        .map((a) => {
          if (a.platform === "META_PAGE") return "facebook";
          if (a.platform === "INSTAGRAM") return "instagram";
          if (a.platform === "TIKTOK") return "tiktok";
          if (a.platform === "THREADS") return "threads";
          return null;
        })
        .filter(Boolean) as SupportedPlatform[]
    )
  );

  const accountNames = accounts
    .filter((a) => selectedAccounts.includes(a.id))
    .reduce<Partial<Record<SupportedPlatform, string>>>((acc, a) => {
      if (a.platform === "META_PAGE") acc.facebook = a.accountName;
      if (a.platform === "INSTAGRAM") acc.instagram = a.accountName;
      if (a.platform === "TIKTOK") acc.tiktok = a.accountName;
      if (a.platform === "THREADS") acc.threads = a.accountName;
      return acc;
    }, {});

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/posts")}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">
                {isEditable ? "Edit Post" : "Detail Post"}
              </h1>
              {getStatusBadge(post.status)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Dibuat{" "}
              {new Date(post.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(post.status === "PUBLISHED" ||
            post.status === "FAILED" ||
            post.status === "PARTIAL") && (
            <>
              <Button variant="outline" size="sm" onClick={handleDuplicate}>
                <Copy className="w-3.5 h-3.5" /> Duplikasi
              </Button>
              {(post.status === "FAILED" || post.status === "PARTIAL") && post.retryCount < 3 && (
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  <RotateCcw className="w-3.5 h-3.5" /> Retry
                </Button>
              )}
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300"
            onClick={handleDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-xs ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : "bg-red-950/40 border-red-800/60 text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 font-medium">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-zinc-400 hover:text-zinc-200">
            ✕
          </button>
        </div>
      )}

      {/* Error details for failed targets */}
      {post.targets.some((t) => t.status === "FAILED") && (
        <Card className="border-red-800/40 bg-red-950/20 rounded-xl">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-red-300">Target yang gagal:</p>
            {post.targets
              .filter((t) => t.status === "FAILED")
              .map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs text-red-200/80">
                  {getPlatformIcon(t.platform)}
                  <span>{t.accountName ?? t.platform}</span>
                  {t.errorMessage && <span className="text-red-400">— {t.errorMessage}</span>}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Form + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Text Content */}
          <Card className="border-zinc-800 bg-zinc-900/40 rounded-xl overflow-hidden">
            <CardContent className="p-0">
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Tulis konten post Anda..."
                rows={6}
                disabled={!isEditable}
                className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-600 p-5 resize-none focus:outline-none leading-relaxed disabled:opacity-60"
              />
              <div className="px-5 pb-3 flex items-center justify-between">
                <span
                  className={`text-[11px] font-mono ${textOverLimit ? "text-red-400 font-semibold" : "text-zinc-500"}`}
                >
                  {textContent.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Media */}
          <Card className="border-zinc-800 bg-zinc-900/40 rounded-xl">
            <CardContent className="p-5 space-y-3">
              <span className="text-xs font-semibold text-zinc-300">Media</span>
              {mediaUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {mediaUrls.map((url, i) => (
                    <div
                      key={i}
                      className="relative group w-16 h-16 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center overflow-hidden"
                    >
                      {url.match(/\.(mp4|mov|webm)$/i) ? (
                        <Video className="w-6 h-6 text-zinc-500" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-zinc-500" />
                      )}
                      {isEditable && (
                        <button
                          onClick={() => removeMedia(i)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Compression progress indicator */}
              {isCompressing && (
                <div
                  data-testid="compression-progress"
                  className="p-3 rounded-lg bg-blue-950/40 border border-blue-800/60 text-blue-300 text-xs space-y-2 animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                      {compressionMessage || "Mengompresi gambar..."}
                    </span>
                    <span className="font-mono text-[11px]">{compressionProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${compressionProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {isEditable && (
                <label
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed transition-all cursor-pointer ${
                    isUploading || isCompressing
                      ? "border-zinc-800 bg-zinc-900/30 opacity-60 cursor-not-allowed"
                      : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500"
                  }`}
                >
                  <Upload className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-400">
                    {isCompressing
                      ? "Mengompresi gambar..."
                      : isUploading
                        ? "Mengupload..."
                        : "Upload gambar atau video"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
                    onChange={handleFileUpload}
                    disabled={isUploading || isCompressing}
                    className="hidden"
                  />
                </label>
              )}
            </CardContent>
          </Card>

          {/* Target Accounts */}
          <Card className="border-zinc-800 bg-zinc-900/40 rounded-xl">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">
                  Akun Tujuan {isEditable && <span className="text-red-400">*</span>}
                </span>
                <span className="text-[11px] text-zinc-500">{selectedAccounts.length} dipilih</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accounts.map((acc) => {
                  const isSelected = selectedAccounts.includes(acc.id);
                  return (
                    <button
                      key={acc.id}
                      onClick={() => isEditable && toggleAccount(acc.id)}
                      disabled={!isEditable}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-zinc-500 bg-zinc-800/70 text-zinc-100"
                          : "border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700"
                      } disabled:opacity-60`}
                    >
                      <div className="shrink-0">{getPlatformIcon(acc.platform)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{acc.accountName}</p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md border-2 shrink-0 flex items-center justify-center ${isSelected ? "bg-zinc-100 border-zinc-100" : "border-zinc-600"}`}
                      >
                        {isSelected && (
                          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-zinc-900">
                            <path
                              d="M10 3L4.5 8.5 2 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Schedule (only for editable posts) */}
          {isEditable && (
            <Card className="border-zinc-800 bg-zinc-900/40 rounded-xl">
              <CardContent className="p-5 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSchedule}
                    onChange={(e) => setUseSchedule(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-zinc-800 border-zinc-600"
                  />
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    Jadwalkan Publikasi
                  </span>
                </label>
                {useSchedule && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date(Date.now() + 6 * 60 * 1000).toISOString().slice(0, 16)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {isEditable && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-8">
              <Button
                variant="outline"
                size="md"
                onClick={handleSave}
                disabled={
                  !canSave ||
                  textOverLimit ||
                  isSaving ||
                  isPublishing ||
                  isUploading ||
                  isCompressing
                }
                isLoading={isSaving}
                className="flex-1"
              >
                <Save className="w-4 h-4" />
                {useSchedule && scheduledAt ? "Simpan & Jadwalkan" : "Simpan"}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handlePublishNow}
                disabled={
                  !canSave ||
                  textOverLimit ||
                  isPublishing ||
                  isSaving ||
                  isUploading ||
                  isCompressing
                }
                isLoading={isPublishing}
                className="flex-1"
              >
                <Send className="w-4 h-4" />
                Publikasikan Sekarang
              </Button>
            </div>
          )}
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <PreviewPanel
            textContent={textContent}
            mediaUrls={mediaUrls}
            selectedPlatforms={selectedPlatforms}
            accountNames={accountNames}
          />
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Postingan */}
      {post && (
        <DeletePostModal
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          post={{
            ...post,
            targets: post.targets.map((t) => {
              const acc = accounts.find((a) => a.id === t.connectedAccountId);
              return {
                ...t,
                accountName: t.accountName || acc?.accountName,
              };
            }),
          }}
          onSuccess={async () => {
            await invalidatePostsCache();
            router.push("/posts");
          }}
        />
      )}
    </div>
  );
}
