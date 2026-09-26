"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Server,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QueueMetrics {
  name: string;
  displayName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  total: number;
  isPaused: boolean;
}

interface QueuesSummary {
  totalWaiting: number;
  totalActive: number;
  totalCompleted: number;
  totalFailed: number;
  totalDelayed: number;
  totalJobs: number;
}

interface SerializedJob {
  id: string;
  name: string;
  queueName: string;
  state: string;
  data: Record<string, unknown>;
  attemptsMade: number;
  maxAttempts: number;
  failedReason: string | null;
  stacktrace: string[];
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  postDetails?: {
    id: string;
    textContent: string;
    status: string;
    targets: Array<{ platform: string; status: string }>;
  } | null;
}

export default function AdminQueuesPage() {
  const [metrics, setMetrics] = useState<Record<string, QueueMetrics> | null>(null);
  const [summary, setSummary] = useState<QueuesSummary | null>(null);
  const [jobs, setJobs] = useState<SerializedJob[]>([]);
  const [activeQueue, setActiveQueue] = useState<string>("publish-queue");
  const [activeStatus, setActiveStatus] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10); // detik (0 = off)
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState<boolean>(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchQueueData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        setIsRefreshing(true);
      }
      try {
        const query = new URLSearchParams({
          queue: activeQueue,
          status: activeStatus,
          limit: "30",
        });

        const res = await apiFetch<{
          metrics: Record<string, QueueMetrics>;
          summary: QueuesSummary;
          jobs: SerializedJob[];
          timestamp: string;
        }>(`/api/admin/queues?${query.toString()}`);

        if (res.ok && res.data) {
          setMetrics(res.data.metrics);
          setSummary(res.data.summary);
          setJobs(res.data.jobs);
          setLastUpdated(
            new Date(res.data.timestamp).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          );
        } else {
          if (!isBackground) {
            setFeedback({
              type: "error",
              message: "Gagal mengambil data antrean dari server.",
            });
          }
        }
      } catch {
        if (!isBackground) {
          setFeedback({
            type: "error",
            message: "Terjadi kesalahan saat memuat observabilitas BullMQ.",
          });
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeQueue, activeStatus]
  );

  useEffect(() => {
    fetchQueueData();
  }, [fetchQueueData]);

  // Handle auto-refresh timer
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (autoRefreshInterval > 0) {
      timerRef.current = setInterval(() => {
        fetchQueueData(true);
      }, autoRefreshInterval * 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [autoRefreshInterval, fetchQueueData]);

  const handleRetryJob = async (jobId: string) => {
    setRetryingJobId(jobId);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>("/api/admin/queues/retry", {
        method: "POST",
        body: JSON.stringify({
          queueName: activeQueue,
          jobId,
        }),
      });

      if (res.ok && res.data?.success) {
        setFeedback({
          type: "success",
          message: res.data.message || `Job ${jobId} berhasil dijadwalkan ulang.`,
        });
        await fetchQueueData(true);
      } else {
        const errorMsg =
          (res.data as { error?: { message?: string } })?.error?.message ||
          "Gagal melakukan retry job.";
        setFeedback({
          type: "error",
          message: errorMsg,
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Terjadi kesalahan saat meminta retry job.",
      });
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleRetryAll = async () => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin melakukan retry pada semua job gagal di antrean "${activeQueue}"?`
    );
    if (!confirmed) return;

    setIsRetryingAll(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        count: number;
        message: string;
        error?: { message?: string };
      }>("/api/admin/queues/retry", {
        method: "POST",
        body: JSON.stringify({
          queueName: activeQueue,
          retryAll: true,
        }),
      });

      if (res.ok && res.data?.success) {
        setFeedback({
          type: "success",
          message: res.data.message || "Seluruh job gagal berhasil dijadwalkan ulang.",
        });
        await fetchQueueData(true);
      } else {
        const errorMsg = res.data?.error?.message || "Gagal melakukan retry semua job.";
        setFeedback({
          type: "error",
          message: errorMsg,
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Terjadi kesalahan jaringan saat retry semua job.",
      });
    } finally {
      setIsRetryingAll(false);
    }
  };

  const currentQueueMetrics = metrics ? metrics[activeQueue] : null;

  const getJobStateBadge = (state: string) => {
    switch (state) {
      case "active":
        return (
          <Badge variant="publishing" className="gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            Aktif
          </Badge>
        );
      case "failed":
        return <Badge variant="failed">Gagal</Badge>;
      case "waiting":
        return <Badge variant="queued">Menunggu</Badge>;
      case "completed":
        return <Badge variant="published">Selesai</Badge>;
      case "delayed":
        return <Badge variant="scheduled">Tertunda</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Observabilitas Antrean BullMQ
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Monitor metrik antrean publish-worker dan token-refresh-worker secara real-time serta
            lakukan retry postingan yang gagal.
          </p>
        </div>

        {/* Toolbar Auto-refresh & Manual Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
            <span className="text-[11px] text-zinc-500">Auto:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              aria-label="Interval Pembaruan Otomatis"
              className="bg-transparent text-zinc-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value={0} className="bg-zinc-900 text-zinc-200">
                Off
              </option>
              <option value={5} className="bg-zinc-900 text-zinc-200">
                5s
              </option>
              <option value={10} className="bg-zinc-900 text-zinc-200">
                10s
              </option>
              <option value={30} className="bg-zinc-900 text-zinc-200">
                30s
              </option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchQueueData(false)}
            isLoading={isRefreshing}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Summary Metric Bar */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3">
            <span className="text-[11px] text-zinc-400">Total Pekerjaan</span>
            <div className="text-xl font-bold text-zinc-100 mt-0.5">{summary.totalJobs}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3">
            <span className="text-[11px] text-zinc-400">Menunggu (Waiting)</span>
            <div className="text-xl font-bold text-indigo-400 mt-0.5">{summary.totalWaiting}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3">
            <span className="text-[11px] text-zinc-400">Sedang Aktif</span>
            <div className="text-xl font-bold text-sky-400 mt-0.5">{summary.totalActive}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3">
            <span className="text-[11px] text-zinc-400">Berhasil Selesai</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">
              {summary.totalCompleted}
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-zinc-400">Total Gagal (Failed)</span>
            <div className="text-xl font-bold text-red-400 mt-0.5">{summary.totalFailed}</div>
          </div>
        </div>
      )}

      {/* Banner Feedback */}
      {feedback && (
        <div
          className={cn(
            "flex items-start gap-3 p-4 rounded-xl border text-xs select-none transition-all shadow-lg",
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300 shadow-emerald-950/20"
              : "bg-red-950/40 border-red-800/60 text-red-300 shadow-red-950/20"
          )}
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

      {/* Grid Kartu Metrik Antrean */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card: Publish Worker Queue */}
          <div
            onClick={() => setActiveQueue("publish-queue")}
            className={cn(
              "rounded-2xl border p-5 transition-all cursor-pointer shadow-sm",
              activeQueue === "publish-queue"
                ? "bg-zinc-900/90 border-indigo-500/50 ring-1 ring-indigo-500/30 shadow-indigo-950/20"
                : "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/60"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Publish Worker Queue</h3>
              </div>
              <Badge variant={metrics["publish-queue"]?.isPaused ? "secondary" : "published"}>
                {metrics["publish-queue"]?.isPaused ? "Dijeda" : "Berjalan"}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400 mb-4">
              Antrean publikasi postingan ke Facebook, Instagram, TikTok, dan Threads.
            </p>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 font-medium">Waiting</div>
                <div className="text-lg font-bold text-indigo-400 mt-0.5">
                  {metrics["publish-queue"]?.waiting ?? 0}
                </div>
              </div>
              <div className="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 font-medium">Active</div>
                <div className="text-lg font-bold text-sky-400 mt-0.5">
                  {metrics["publish-queue"]?.active ?? 0}
                </div>
              </div>
              <div className="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 font-medium">Completed</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">
                  {metrics["publish-queue"]?.completed ?? 0}
                </div>
              </div>
              <div className="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 font-medium">Failed</div>
                <div className="text-lg font-bold text-red-400 mt-0.5">
                  {metrics["publish-queue"]?.failed ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Card: Token Refresh Worker Queue */}
          <div
            onClick={() => setActiveQueue("token-refresh-queue")}
            className={cn(
              "rounded-2xl border p-5 transition-all cursor-pointer shadow-sm",
              activeQueue === "token-refresh-queue"
                ? "bg-zinc-900/90 border-indigo-500/50 ring-1 ring-indigo-500/30 shadow-indigo-950/20"
                : "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/60"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Token Refresh Worker Queue</h3>
              </div>
              <Badge variant={metrics["token-refresh-queue"]?.isPaused ? "secondary" : "published"}>
                {metrics["token-refresh-queue"]?.isPaused ? "Dijeda" : "Berjalan"}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400 mb-4">
              Antrean proaktif pembaruan OAuth token sebelum kedaluwarsa.
            </p>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 font-medium">Waiting</div>
                <div className="text-lg font-bold text-indigo-400 mt-0.5">
                  {metrics["token-refresh-queue"]?.waiting ?? 0}
                </div>
              </div>
              <div className="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 font-medium">Active</div>
                <div className="text-lg font-bold text-sky-400 mt-0.5">
                  {metrics["token-refresh-queue"]?.active ?? 0}
                </div>
              </div>
              <div className="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 font-medium">Completed</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">
                  {metrics["token-refresh-queue"]?.completed ?? 0}
                </div>
              </div>
              <div className="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 font-medium">Failed</div>
                <div className="text-lg font-bold text-red-400 mt-0.5">
                  {metrics["token-refresh-queue"]?.failed ?? 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kontainer Daftar Job dan Filter */}
      <Card className="border-zinc-800 bg-zinc-900/40 rounded-2xl overflow-hidden shadow-lg">
        <CardHeader className="p-5 pb-4 border-b border-zinc-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                Daftar Job (
                {activeQueue === "publish-queue" ? "Publish Queue" : "Token Refresh Queue"})
                {lastUpdated && (
                  <span className="text-[11px] font-normal text-zinc-500">
                    • Terakhir diperbarui {lastUpdated}
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5 text-zinc-400">
                Inspeksi riwayat eksekusi, status kegagalan, dan jalankan aksi retry.
              </CardDescription>
            </div>

            {/* Aksi Retry Semua */}
            {currentQueueMetrics && currentQueueMetrics.failed > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRetryAll}
                isLoading={isRetryingAll}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Retry Semua Gagal ({currentQueueMetrics.failed})
              </Button>
            )}
          </div>

          {/* Filter Status Job */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3">
            {[
              { id: "all", label: "Semua" },
              { id: "failed", label: `Gagal (${currentQueueMetrics?.failed ?? 0})` },
              { id: "active", label: `Aktif (${currentQueueMetrics?.active ?? 0})` },
              { id: "waiting", label: `Menunggu (${currentQueueMetrics?.waiting ?? 0})` },
              { id: "delayed", label: `Tertunda (${currentQueueMetrics?.delayed ?? 0})` },
              { id: "completed", label: `Selesai (${currentQueueMetrics?.completed ?? 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveStatus(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors select-none",
                  activeStatus === tab.id
                    ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-zinc-500">
              <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
              Memuat data antrean...
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 space-y-2">
              <Layers className="w-9 h-9 mx-auto text-zinc-600" />
              <p className="text-sm font-medium text-zinc-300">Tidak ada job ditemukan</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Antrean ini sedang bersih atau tidak ada pekerjaan dengan status yang dipilih.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/80">
              {jobs.map((job) => {
                const isExpanded = expandedJobId === job.id;
                const isFailed = job.state === "failed";
                const isRetrying = retryingJobId === job.id;

                return (
                  <div
                    key={job.id}
                    className="p-4 sm:px-6 hover:bg-zinc-900/40 transition-colors space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-zinc-200">
                            #{job.id}
                          </span>
                          <span className="text-xs font-medium text-zinc-300">{job.name}</span>
                          {getJobStateBadge(job.state)}
                          <span className="text-[11px] text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/60">
                            Percobaan: {job.attemptsMade} / {job.maxAttempts}
                          </span>
                        </div>

                        {/* Detail Postingan jika tersedia */}
                        {job.postDetails && (
                          <div className="text-xs text-zinc-400 flex items-center gap-2 pt-0.5">
                            <span className="text-zinc-500 font-mono text-[11px]">Post:</span>
                            <span className="text-zinc-200 font-medium truncate max-w-md">
                              &ldquo;{job.postDetails.textContent}&rdquo;
                            </span>
                            <span className="text-zinc-600">•</span>
                            <div className="flex items-center gap-1">
                              {job.postDetails.targets.map((t, idx) => (
                                <span
                                  key={idx}
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.2 rounded border font-mono",
                                    t.status === "PUBLISHED"
                                      ? "bg-emerald-950/50 text-emerald-400 border-emerald-800/50"
                                      : t.status === "FAILED"
                                        ? "bg-red-950/50 text-red-400 border-red-800/50"
                                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                  )}
                                >
                                  {t.platform}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                          {job.timestamp > 0 && (
                            <span>
                              Dibuat:{" "}
                              {new Date(job.timestamp).toLocaleString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          )}
                          {job.finishedOn && (
                            <>
                              <span>•</span>
                              <span>
                                Selesai:{" "}
                                {new Date(job.finishedOn).toLocaleString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Tombol Aksi */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {isFailed && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRetryJob(job.id)}
                            isLoading={isRetrying}
                            className="border-zinc-700 hover:border-zinc-500"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Retry Job
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                          className="text-zinc-400 hover:text-zinc-200"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5 mr-1" /> Tutup
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5 mr-1" /> Detail
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expandable Failure Reason & Details */}
                    {isExpanded && (
                      <div className="mt-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-2.5">
                        {job.failedReason && (
                          <div className="space-y-1">
                            <span className="font-semibold text-red-400 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Penyebab Kegagalan:
                            </span>
                            <pre className="font-mono text-[11px] text-red-300/90 whitespace-pre-wrap bg-red-950/20 p-2.5 rounded-lg border border-red-900/40">
                              {job.failedReason}
                            </pre>
                          </div>
                        )}

                        <div className="space-y-1">
                          <span className="font-semibold text-zinc-300">Payload Data:</span>
                          <pre className="font-mono text-[11px] text-zinc-400 whitespace-pre-wrap bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                            {JSON.stringify(job.data, null, 2)}
                          </pre>
                        </div>

                        {job.stacktrace && job.stacktrace.length > 0 && (
                          <div className="space-y-1">
                            <span className="font-semibold text-zinc-400">Stacktrace:</span>
                            <pre className="font-mono text-[10px] text-zinc-500 whitespace-pre-wrap bg-zinc-900/80 p-2 rounded max-h-36 overflow-y-auto">
                              {job.stacktrace.join("\n")}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
