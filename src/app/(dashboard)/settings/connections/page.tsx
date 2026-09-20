"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MetaLogo,
  FacebookLogo,
  InstagramLogo,
  TikTokLogo,
  ThreadsLogo,
} from "@/components/ui/platform-icons";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Share2,
  Trash2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface ConnectedAccount {
  id: string;
  userId: string;
  platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
  platformAccountId: string;
  accountName: string;
  status: "ACTIVE" | "EXPIRED" | "NEEDS_REAUTH";
  tokenExpiresAt: string | null;
  meta?: {
    notification?: {
      message?: string;
    };
  } | null;
  createdAt: string;
  updatedAt: string;
}

function ConnectionsContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Baca feedback dari URL search params
  useEffect(() => {
    const successParam = searchParams.get("success");
    const errorParam = searchParams.get("error");
    const messageParam = searchParams.get("message");

    if (successParam === "meta") {
      setFeedback({
        type: "success",
        message: "Akun Meta (Facebook Page / Instagram) berhasil dihubungkan.",
      });
    } else if (successParam === "tiktok") {
      setFeedback({
        type: "success",
        message: "Akun TikTok berhasil dihubungkan.",
      });
    } else if (successParam === "threads") {
      setFeedback({
        type: "success",
        message: "Akun Threads berhasil dihubungkan.",
      });
    } else if (errorParam) {
      if (errorParam === "access_denied") {
        setFeedback({
          type: "error",
          message: "Otorisasi akun dibatalkan oleh pengguna.",
        });
      } else {
        setFeedback({
          type: "error",
          message: messageParam || `Koneksi gagal (${errorParam}). Silakan coba hubungkan kembali.`,
        });
      }
    }
  }, [searchParams]);

  // Muat daftar akun yang terhubung
  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: ConnectedAccount[] }>("/api/connect/accounts");
      if (res.ok && Array.isArray(res.data?.data)) {
        setAccounts(res.data.data);
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Gagal memuat daftar akun yang terhubung.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Putuskan koneksi akun
  const handleDisconnect = async (accountId: string, accountName: string) => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin memutuskan koneksi akun "${accountName}"?`
    );
    if (!confirmed) return;

    setDisconnectingId(accountId);
    try {
      const res = await apiFetch(`/api/connect/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
        setFeedback({
          type: "success",
          message: `Koneksi akun "${accountName}" berhasil diputuskan.`,
        });
      } else {
        setFeedback({
          type: "error",
          message: "Gagal memutuskan koneksi akun.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Terjadi kesalahan saat memutuskan koneksi akun.",
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  const staleAccounts = accounts.filter((acc) => acc.status === "NEEDS_REAUTH");

  const metaAccountsCount = accounts.filter(
    (a) => a.platform === "META_PAGE" || a.platform === "INSTAGRAM"
  ).length;
  const tiktokAccountsCount = accounts.filter((a) => a.platform === "TIKTOK").length;
  const threadsAccountsCount = accounts.filter((a) => a.platform === "THREADS").length;

  const getPlatformIcon = (platform: ConnectedAccount["platform"]) => {
    switch (platform) {
      case "META_PAGE":
        return <FacebookLogo className="w-8 h-8 rounded-lg shadow-sm" />;
      case "INSTAGRAM":
        return <InstagramLogo className="w-8 h-8 rounded-lg shadow-sm" />;
      case "TIKTOK":
        return <TikTokLogo className="w-8 h-8 rounded-lg shadow-sm" />;
      case "THREADS":
        return <ThreadsLogo className="w-8 h-8 rounded-lg shadow-sm" />;
      default:
        return <Share2 className="w-8 h-8 text-zinc-400" />;
    }
  };

  const getPlatformBadge = (platform: ConnectedAccount["platform"]) => {
    switch (platform) {
      case "META_PAGE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <FacebookLogo className="w-3 h-3" />
            Facebook Page
          </span>
        );
      case "INSTAGRAM":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-pink-400 border border-pink-500/20">
            <InstagramLogo className="w-3 h-3" />
            Instagram Business
          </span>
        );
      case "TIKTOK":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-cyan-300 border border-cyan-500/20">
            <TikTokLogo className="w-3 h-3" />
            TikTok
          </span>
        );
      case "THREADS":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-200 border border-zinc-700">
            <ThreadsLogo className="w-3 h-3" />
            Threads
          </span>
        );
      default:
        return <Badge variant="outline">{platform}</Badge>;
    }
  };

  const getStatusBadge = (status: ConnectedAccount["status"]) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="published">Aktif</Badge>;
      case "NEEDS_REAUTH":
        return <Badge variant="reauth">Perlu Reautentikasi</Badge>;
      case "EXPIRED":
        return <Badge variant="failed">Kedaluwarsa</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Koneksi Platform</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Hubungkan dan kelola akun media sosial untuk otomatisasi penerbitan dan penjadwalan
            konten.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAccounts} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Banner Notifikasi Feedback (Sukses/Error) */}
      {feedback && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-xs select-none transition-all shadow-lg ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300 shadow-emerald-950/20"
              : "bg-red-950/40 border-red-800/60 text-red-300 shadow-red-950/20"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{feedback.message}</div>
          <button
            onClick={() => setFeedback(null)}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Notifikasi Peringatan Reautentikasi */}
      {staleAccounts.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-orange-800/60 bg-orange-950/40 text-orange-200 text-xs shadow-lg shadow-orange-950/20">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-orange-300">
              Perhatian: {staleAccounts.length} akun memerlukan autentikasi ulang
            </p>
            <p className="text-orange-200/80">
              Token akses untuk akun berikut telah kedaluwarsa atau gagal diperbarui otomatis:{" "}
              <span className="font-medium text-orange-100">
                {staleAccounts.map((a) => a.accountName).join(", ")}
              </span>
              . Sambungkan kembali untuk melanjutkan publikasi otomatis.
            </p>
          </div>
        </div>
      )}

      {/* Grid Kartu Tambah Koneksi Platform Baru */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
            Platform Media Sosial Tersedia
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Pilih platform yang ingin dihubungkan ke sistem Mupost.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Meta (Facebook & Instagram) */}
          <div className="group relative rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-5 flex flex-col justify-between hover:border-blue-500/40 hover:bg-zinc-900/80 transition-all duration-200 shadow-sm hover:shadow-xl hover:shadow-blue-500/5">
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-inner">
                    <MetaLogo className="w-6 h-6" />
                  </div>
                  <div className="flex -space-x-2">
                    <FacebookLogo className="w-5 h-5 rounded-full ring-2 ring-zinc-900 shadow-sm" />
                    <InstagramLogo className="w-5 h-5 rounded-full ring-2 ring-zinc-900 shadow-sm" />
                  </div>
                </div>
                {metaAccountsCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {metaAccountsCount} Aktif
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-zinc-500 bg-zinc-800/60 border border-zinc-700/60 px-2.5 py-0.5 rounded-full">
                    Tersedia
                  </span>
                )}
              </div>

              <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-blue-300 transition-colors">
                Meta Ecosystem
              </h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Kelola publikasi otomatis ke <strong>Facebook Page</strong> dan{" "}
                <strong>Instagram Business</strong> secara bersamaan.
              </p>

              <div className="flex flex-wrap gap-1.5 mt-3.5 pt-3 border-t border-zinc-800/80">
                <span className="text-[10px] font-medium text-blue-300/90 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                  Facebook Page
                </span>
                <span className="text-[10px] font-medium text-pink-300/90 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-md">
                  Instagram Business
                </span>
              </div>
            </div>

            <div className="mt-5">
              <a href="/api/connect/meta/authorize" className="block">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-500/20 transition-all"
                >
                  <MetaLogo className="w-4 h-4 mr-2" />
                  Hubungkan Akun Meta
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 ml-auto" />
                </Button>
              </a>
            </div>
          </div>

          {/* Card 2: TikTok */}
          <div className="group relative rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-5 flex flex-col justify-between hover:border-pink-500/40 hover:bg-zinc-900/80 transition-all duration-200 shadow-sm hover:shadow-xl hover:shadow-pink-500/5">
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shadow-inner">
                  <TikTokLogo className="w-6 h-6" />
                </div>
                {tiktokAccountsCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {tiktokAccountsCount} Aktif
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-zinc-500 bg-zinc-800/60 border border-zinc-700/60 px-2.5 py-0.5 rounded-full">
                    Tersedia
                  </span>
                )}
              </div>

              <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-pink-300 transition-colors">
                TikTok Creator & Business
              </h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Jadwalkan dan publikasikan konten video pendek langsung ke akun kreator atau bisnis
                TikTok Anda.
              </p>

              <div className="flex flex-wrap gap-1.5 mt-3.5 pt-3 border-t border-zinc-800/80">
                <span className="text-[10px] font-medium text-cyan-300/90 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                  Video Publishing
                </span>
                <span className="text-[10px] font-medium text-pink-300/90 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-md">
                  Auto Token Refresh
                </span>
              </div>
            </div>

            <div className="mt-5">
              <a href="/api/connect/tiktok/authorize" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-zinc-700 hover:border-pink-500/50 hover:bg-zinc-800 text-zinc-100 font-medium transition-all"
                >
                  <TikTokLogo className="w-4 h-4 mr-2" />
                  Hubungkan Akun TikTok
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 ml-auto" />
                </Button>
              </a>
            </div>
          </div>

          {/* Card 3: Threads */}
          <div className="group relative rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-5 flex flex-col justify-between hover:border-zinc-500/40 hover:bg-zinc-900/80 transition-all duration-200 shadow-sm hover:shadow-xl hover:shadow-white/5">
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shadow-inner">
                  <ThreadsLogo className="w-6 h-6" />
                </div>
                {threadsAccountsCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {threadsAccountsCount} Aktif
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-zinc-500 bg-zinc-800/60 border border-zinc-700/60 px-2.5 py-0.5 rounded-full">
                    Tersedia
                  </span>
                )}
              </div>

              <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-zinc-200 transition-colors">
                Threads by Meta
              </h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Bagikan opini, utas teks, dan posting media gambar/video langsung ke akun profil
                Threads Anda.
              </p>

              <div className="flex flex-wrap gap-1.5 mt-3.5 pt-3 border-t border-zinc-800/80">
                <span className="text-[10px] font-medium text-zinc-300 bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 rounded-md">
                  Text & Media Threads
                </span>
                <span className="text-[10px] font-medium text-zinc-300 bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 rounded-md">
                  Direct Threads API
                </span>
              </div>
            </div>

            <div className="mt-5">
              <a href="/api/connect/threads/authorize" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-zinc-700 hover:border-zinc-400 hover:bg-zinc-800 text-zinc-100 font-medium transition-all"
                >
                  <ThreadsLogo className="w-4 h-4 mr-2" />
                  Hubungkan Akun Threads
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 ml-auto" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Daftar Akun Terhubung */}
      <Card className="border-zinc-800 bg-zinc-900/40 rounded-2xl overflow-hidden shadow-lg">
        <CardHeader className="p-5 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                Akun Terhubung
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {accounts.length} Akun
                </span>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5 text-zinc-400">
                Daftar akun media sosial yang telah terhubung dan siap digunakan untuk posting.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-zinc-500">
              <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
              Memuat daftar akun...
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 space-y-2">
              <Share2 className="w-9 h-9 mx-auto text-zinc-600" />
              <p className="text-sm font-medium text-zinc-300">Belum ada akun yang terhubung</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Gunakan kartu platform di atas untuk menghubungkan akun Meta, TikTok, atau Threads
                pertama Anda.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/80">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="shrink-0">{getPlatformIcon(acc.platform)}</div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100">
                          {acc.accountName}
                        </span>
                        {getPlatformBadge(acc.platform)}
                        {getStatusBadge(acc.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                        <span className="font-mono text-[11px] text-zinc-500">
                          ID: {acc.platformAccountId}
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span>
                          Masa Berlaku Token:{" "}
                          <span className="text-zinc-300">
                            {acc.tokenExpiresAt
                              ? new Date(acc.tokenExpiresAt).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Permanen"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {acc.status === "NEEDS_REAUTH" && (
                      <a
                        href={
                          acc.platform === "TIKTOK"
                            ? "/api/connect/tiktok/authorize"
                            : acc.platform === "THREADS"
                              ? "/api/connect/threads/authorize"
                              : "/api/connect/meta/authorize"
                        }
                      >
                        <Button variant="outline" size="sm">
                          Sambungkan Ulang
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-zinc-400 hover:text-red-400 hover:bg-red-950/30"
                      onClick={() => handleDisconnect(acc.id, acc.accountName)}
                      isLoading={disconnectingId === acc.id}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Putuskan
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-12 text-center text-xs text-zinc-500">
          <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Memuat koneksi platform...
        </div>
      }
    >
      <ConnectionsContent />
    </React.Suspense>
  );
}
