"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FacebookLogo,
  InstagramLogo,
  TikTokLogo,
  ThreadsLogo,
} from "@/components/ui/platform-icons";
import {
  Share2,
  PlusSquare,
  UploadCloud,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  FileText,
  ChevronRight,
  Activity,
} from "lucide-react";

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
}

interface ConnectedAccount {
  id: string;
  userId: string;
  platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
  accountName: string;
  status: "ACTIVE" | "EXPIRED" | "NEEDS_REAUTH";
}

interface PostTarget {
  id: string;
  platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
  status: string;
  accountName?: string;
}

interface PostItem {
  id: string;
  textContent: string;
  mediaUrls: string[] | null;
  status: "DRAFT" | "SCHEDULED" | "QUEUED" | "PUBLISHING" | "PUBLISHED" | "PARTIAL" | "FAILED";
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  targets: PostTarget[];
}

interface DashboardStats {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
  failedPosts: number;
  platformDistribution: {
    META_PAGE: number;
    INSTAGRAM: number;
    TIKTOK: number;
    THREADS: number;
  };
}

interface DashboardData {
  accounts: ConnectedAccount[];
  stats: DashboardStats;
  recentPosts: PostItem[];
}

function getPlatformIcon(
  platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS",
  size = "w-4 h-4"
) {
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

function getStatusBadge(status: PostItem["status"]) {
  const map: Record<
    PostItem["status"],
    {
      variant:
        | "default"
        | "scheduled"
        | "published"
        | "failed"
        | "outline"
        | "secondary"
        | "publishing";
      label: string;
    }
  > = {
    DRAFT: { variant: "default", label: "Draft" },
    SCHEDULED: { variant: "scheduled", label: "Terjadwal" },
    QUEUED: { variant: "outline", label: "Antrean" },
    PUBLISHING: { variant: "publishing", label: "Memproses" },
    PUBLISHED: { variant: "published", label: "Terpublikasi" },
    PARTIAL: { variant: "scheduled", label: "Sebagian" },
    FAILED: { variant: "failed", label: "Gagal" },
  };
  const s = map[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, statsRes] = await Promise.all([
          apiFetch<{ user: UserProfile }>("/api/auth/me"),
          apiFetch<{ data: DashboardData }>("/api/dashboard/stats"),
        ]);

        if (meRes.ok && meRes.data?.user) {
          setUser(meRes.data.user);
        } else {
          router.push("/login");
          return;
        }

        if (statsRes.ok && statsRes.data?.data) {
          setDashboardData(statsRes.data.data);
        }
      } catch {
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        <div className="flex items-center gap-2.5 text-xs">
          <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          <span>Memuat data dashboard...</span>
        </div>
      </div>
    );
  }

  const accounts = dashboardData?.accounts ?? [];
  const stats = dashboardData?.stats;
  const recentPosts = dashboardData?.recentPosts ?? [];
  const hasConnectedAccounts = accounts.length > 0;
  const activeAccounts = accounts.filter((a) => a.status === "ACTIVE");

  return (
    <div className="space-y-6">
      {/* Header Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Ringkasan Dashboard
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Selamat datang kembali,{" "}
            <span className="text-zinc-200 font-medium">{user?.fullName}</span> ({user?.email})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasConnectedAccounts ? (
            <Badge variant="published" className="h-6 gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeAccounts.length} Akun Terhubung
            </Badge>
          ) : (
            <Badge variant="failed" className="h-6 gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Belum Ada Akun
            </Badge>
          )}
        </div>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/posts/new" className="group">
          <Card className="h-full hover:border-zinc-700 transition-colors border-zinc-800/80 bg-zinc-900/40">
            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-xs font-semibold text-zinc-200">
                      Buat Post Baru
                    </CardTitle>
                    <CardDescription className="text-[11px] text-zinc-400 mt-0.5">
                      Tulis & publikasikan
                    </CardDescription>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/posts/import" className="group">
          <Card className="h-full hover:border-zinc-700 transition-colors border-zinc-800/80 bg-zinc-900/40">
            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-xs font-semibold text-zinc-200">
                      Import CSV
                    </CardTitle>
                    <CardDescription className="text-[11px] text-zinc-400 mt-0.5">
                      Jadwalkan massal
                    </CardDescription>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/connections" className="group">
          <Card className="h-full hover:border-zinc-700 transition-colors border-zinc-800/80 bg-zinc-900/40">
            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-xs font-semibold text-zinc-200">
                      Kelola Akun
                    </CardTitle>
                    <CardDescription className="text-[11px] text-zinc-400 mt-0.5">
                      Koneksi & izin OAuth
                    </CardDescription>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* KONDISIONAL: JIKA SUDAH ADA AKUN TERHUBUNG -> TAMPILKAN DASHBOARD STATISTIK */}
      {hasConnectedAccounts ? (
        <div className="space-y-6">
          {/* STATS METRIC TILES */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4 border-zinc-800/80 bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-medium">Total Post</span>
                <Layers className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-zinc-100">{stats?.totalPosts ?? 0}</div>
              <p className="text-[10px] text-zinc-500 mt-1">Seluruh riwayat posting</p>
            </Card>

            <Card className="p-4 border-zinc-800/80 bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-400/90 font-medium">Terpublikasi</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-zinc-100">
                {stats?.publishedPosts ?? 0}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Berhasil tayang di platform</p>
            </Card>

            <Card className="p-4 border-zinc-800/80 bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-400/90 font-medium">Terjadwal</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-zinc-100">
                {stats?.scheduledPosts ?? 0}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Menunggu waktu tayang</p>
            </Card>

            <Card className="p-4 border-zinc-800/80 bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-medium">Draft & Gagal</span>
                <FileText className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-zinc-100">
                {(stats?.draftPosts ?? 0) + (stats?.failedPosts ?? 0)}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                {stats?.draftPosts ?? 0} draft / {stats?.failedPosts ?? 0} gagal
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* KOLOM KIRI (2/3): Postingan Terbaru */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Aktivitas Postingan Terbaru
                </h2>
                <Link
                  href="/posts"
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
                >
                  Lihat Semua
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {recentPosts.length === 0 ? (
                <Card className="p-8 border-zinc-800/80 bg-zinc-900/30 text-center">
                  <p className="text-xs text-zinc-400">Belum ada riwayat postingan.</p>
                  <Link href="/posts/new" className="inline-block mt-3">
                    <Button variant="primary" size="sm">
                      Buat Postingan Sekarang
                    </Button>
                  </Link>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {recentPosts.map((post) => (
                    <Card
                      key={post.id}
                      className="p-4 border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-200 font-medium line-clamp-2 leading-relaxed">
                            {post.textContent}
                          </p>
                          <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-[11px] text-zinc-500">
                            <span>{formatDate(post.createdAt)}</span>
                            {post.scheduledAt && (
                              <span className="flex items-center gap-1 text-amber-400/80">
                                <Clock className="w-3 h-3" />
                                {formatDate(post.scheduledAt)}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 ml-1">
                              {post.targets.map((t) => (
                                <span key={t.id} title={t.platform}>
                                  {getPlatformIcon(t.platform, "w-3.5 h-3.5")}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {getStatusBadge(post.status)}
                          <Link href={`/posts`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* KOLOM KANAN (1/3): Distribusi Platform & Status Akun */}
            <div className="space-y-4">
              {/* Distribusi Post Per Platform */}
              <Card className="border-zinc-800/80 bg-zinc-900/40">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-xs font-semibold text-zinc-200">
                    Distribusi Publikasi Platform
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500">
                    Jumlah target berhasil tayang
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-300">
                      <FacebookLogo className="w-3.5 h-3.5" />
                      Facebook Page
                    </span>
                    <span className="font-semibold text-zinc-200">
                      {stats?.platformDistribution.META_PAGE ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-300">
                      <InstagramLogo className="w-3.5 h-3.5" />
                      Instagram
                    </span>
                    <span className="font-semibold text-zinc-200">
                      {stats?.platformDistribution.INSTAGRAM ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-300">
                      <TikTokLogo className="w-3.5 h-3.5" />
                      TikTok
                    </span>
                    <span className="font-semibold text-zinc-200">
                      {stats?.platformDistribution.TIKTOK ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-zinc-300">
                      <ThreadsLogo className="w-3.5 h-3.5" />
                      Threads
                    </span>
                    <span className="font-semibold text-zinc-200">
                      {stats?.platformDistribution.THREADS ?? 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Status Akun Terhubung */}
              <Card className="border-zinc-800/80 bg-zinc-900/40">
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-zinc-200">
                      Akun Media Sosial
                    </CardTitle>
                    <Link
                      href="/settings/connections"
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Kelola
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2.5">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/60"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {getPlatformIcon(acc.platform, "w-4 h-4 shrink-0")}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-200 truncate">
                            {acc.accountName}
                          </p>
                          <span className="text-[10px] text-zinc-500 capitalize">
                            {acc.platform.replace("_", " ").toLowerCase()}
                          </span>
                        </div>
                      </div>
                      <div>
                        {acc.status === "ACTIVE" ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-950/60 text-amber-400 border border-amber-800/50">
                            Perlu Auth
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        /* KONDISIONAL: JIKA BELUM ADA AKUN TERHUBUNG -> TAMPILKAN ONBOARDING PANDUAN KONEKSI */
        <Card className="border-zinc-800 bg-zinc-900/40">
          <CardHeader className="p-6 pb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/50 border border-cyan-800/50 flex items-center justify-center text-cyan-400 mb-2">
              <Share2 className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">Mulai dengan Menghubungkan Platform</CardTitle>
            <CardDescription className="text-xs">
              Anda belum memiliki akun media sosial yang terhubung. Hubungkan akun Anda untuk mulai
              menerbitkan dan menjadwalkan postingan.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-lg bg-zinc-950/50 border border-zinc-800/80 flex items-start gap-3">
                <div className="mt-0.5">{getPlatformIcon("META_PAGE", "w-5 h-5")}</div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">
                    Meta (Facebook & Instagram)
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Hubungkan Facebook Page dan Instagram Business / Creator via Meta OAuth.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-950/50 border border-zinc-800/80 flex items-start gap-3">
                <div className="mt-0.5">{getPlatformIcon("TIKTOK", "w-5 h-5")}</div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">TikTok & Threads</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Otorisasi akun TikTok Video dan Threads untuk publikasi multi-channel otomatis.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/settings/connections">
                <Button variant="primary" className="text-xs gap-2">
                  <Share2 className="w-4 h-4" />
                  Hubungkan Akun Sekarang
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
