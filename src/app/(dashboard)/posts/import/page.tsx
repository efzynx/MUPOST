"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { invalidatePostsCache } from "@/lib/pwa-cache";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  FileCheck,
  Layers,
} from "lucide-react";

interface CsvRowError {
  rowNumber: number;
  column: string;
  description: string;
}

interface ImportSummary {
  createdCount: number;
  skippedCount: number;
  totalRows: number;
  createdPosts: Array<{
    id: string;
    status: string;
    scheduledAt: string;
    textContent: string;
  }>;
  errors: CsvRowError[];
}

export default function CsvImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndSelectFile = (selectedFile: File) => {
    setErrorMessage(null);
    setSummary(null);

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Hanya file dengan format .csv yang dapat diterima.");
      setFile(null);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMessage("Ukuran file tidak boleh melebihi 5 MB.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    setSummary(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/csv/upload", {
        method: "POST",
        body: formData,
      });

      const json = await response.json();

      if (!response.ok) {
        if (json.error?.details?.invalidRows) {
          setSummary({
            createdCount: 0,
            skippedCount: json.error.details.totalRows || 0,
            totalRows: json.error.details.totalRows || 0,
            createdPosts: [],
            errors: json.error.details.invalidRows,
          });
        }
        setErrorMessage(json.error?.message || "Gagal memproses file CSV.");
        return;
      }

      setSummary(json.data);
      invalidatePostsCache().catch(() => {});
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat mengunggah file."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header & Navigasi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <Link
            href="/posts"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title="Kembali ke Daftar Postingan"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Import Post via CSV</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Jadwalkan atau publikasikan puluhan postingan sekaligus dari template spreadsheet CSV.
            </p>
          </div>
        </div>

        <a
          href="/api/csv/template"
          download="mupost_template.csv"
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900/60 hover:bg-zinc-800 hover:text-zinc-100 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-zinc-400" />
          Unduh Template CSV
        </a>
      </div>

      {/* Pesan Error Global */}
      {errorMessage && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-3 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-red-200">Gagal Memproses CSV</p>
            <p className="text-red-300/90 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Ringkasan Hasil Upload */}
      {summary && (
        <div className="space-y-4">
          <Card className="border-zinc-800/80 bg-zinc-900/40 rounded-xl overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60">
                <div className="flex items-center gap-2.5">
                  {summary.createdCount > 0 ? (
                    <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">
                      Hasil Pemrosesan File CSV
                    </h2>
                    <p className="text-xs text-zinc-400">
                      {summary.createdCount > 0
                        ? "Seluruh atau sebagian postingan berhasil diimpor ke sistem."
                        : "Tidak ada baris data yang berhasil diimpor. Periksa kesalahan di bawah."}
                    </p>
                  </div>
                </div>

                <Badge variant={summary.createdCount > 0 ? "published" : "failed"} className="h-6">
                  {summary.createdCount > 0 ? "Selesai Diproses" : "Perlu Perbaikan"}
                </Badge>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800/70">
                  <span className="text-[11px] font-medium text-emerald-400/90 uppercase tracking-wider">
                    Post Berhasil Dibuat
                  </span>
                  <p className="text-2xl font-bold text-zinc-100 mt-1">{summary.createdCount}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Siap di antrean posting</p>
                </div>

                <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800/70">
                  <span className="text-[11px] font-medium text-amber-400/90 uppercase tracking-wider">
                    Baris Gagal / Dilewati
                  </span>
                  <p className="text-2xl font-bold text-zinc-100 mt-1">{summary.skippedCount}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Validasi format tidak sesuai</p>
                </div>

                <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800/70">
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    Total Baris Data
                  </span>
                  <p className="text-2xl font-bold text-zinc-100 mt-1">{summary.totalRows}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Baris terbaca dari file</p>
                </div>
              </div>

              {/* Tabel Laporan Error */}
              {summary.errors && summary.errors.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      Detail Kesalahan Validasi ({summary.errors.length})
                    </h3>
                    <span className="text-[11px] text-zinc-500">
                      Perbaiki baris terkait pada file CSV Anda
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/50">
                    <table className="min-w-full divide-y divide-zinc-800 text-xs">
                      <thead className="bg-zinc-900/60">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-zinc-400 w-24">
                            Baris
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-zinc-400 w-36">
                            Kolom
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-zinc-400">
                            Deskripsi Masalah
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {summary.errors.map((err, idx) => (
                          <tr key={idx} className="hover:bg-zinc-900/40 transition-colors">
                            <td className="px-4 py-3 font-mono text-zinc-300 font-semibold">
                              #{err.rowNumber}
                            </td>
                            <td className="px-4 py-3 font-medium text-amber-400">{err.column}</td>
                            <td className="px-4 py-3 text-zinc-400">{err.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tombol Aksi Selesai */}
              <div className="pt-3 border-t border-zinc-800/60 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => router.push("/posts")}
                  className="text-xs gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Buka Daftar Postingan
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFile(null);
                    setSummary(null);
                    setErrorMessage(null);
                  }}
                  className="text-xs gap-1.5"
                >
                  Upload File Lain
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Box (jika belum ada summary) */}
      {!summary && (
        <Card className="border-zinc-800/80 bg-zinc-900/40 rounded-xl overflow-hidden">
          <CardContent className="p-6 space-y-6">
            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                dragActive
                  ? "border-cyan-500 bg-cyan-950/20 shadow-inner"
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-950/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 mb-3 shadow-md">
                <Upload className="w-5 h-5 text-cyan-400" />
              </div>

              <p className="text-sm font-medium text-zinc-200 mb-1">
                Tarik dan lepas file CSV di sini, atau klik untuk memilih file
              </p>
              <p className="text-xs text-zinc-500 max-w-sm">
                Maksimal 500 baris data postingan per unggahan. Ukuran berkas maksimal 5 MB.
              </p>
            </div>

            {/* File Terpilih Box */}
            {file && (
              <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-950/50 border border-emerald-800/50 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">{file.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {(file.size / 1024).toFixed(1)} KB • Siap diproses
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  title="Batalkan pilihan berkas"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Panduan Format Kolom CSV */}
            <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-2.5 text-xs text-zinc-300">
              <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                <FileCheck className="w-4 h-4 text-cyan-400" />
                <span>Panduan Format Kolom CSV yang Diperlukan:</span>
              </div>
              <ul className="space-y-1.5 text-zinc-400 pl-1 list-none">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                  <div>
                    <code className="text-zinc-200 font-semibold font-mono bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">
                      platform
                    </code>
                    : Nilai platform tujuan (pilihan:{" "}
                    <code className="text-cyan-300">facebook</code>,{" "}
                    <code className="text-cyan-300">instagram</code>,{" "}
                    <code className="text-cyan-300">tiktok</code>, atau{" "}
                    <code className="text-cyan-300">threads</code>).
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                  <div>
                    <code className="text-zinc-200 font-semibold font-mono bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">
                      text_content
                    </code>
                    : Isi konten teks postingan (maksimal 2.000 karakter).
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                  <div>
                    <code className="text-zinc-200 font-semibold font-mono bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">
                      scheduled_at
                    </code>
                    : Waktu tayang format ISO 8601 di masa depan (contoh:{" "}
                    <code className="text-zinc-300">2026-10-15T14:30:00Z</code>). Kosongkan jika
                    ingin disimpan sebagai Draft.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                  <div>
                    <code className="text-zinc-200 font-semibold font-mono bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">
                      media_url
                    </code>
                    : URL berkas media gambar/video publik (opsional, diawali{" "}
                    <code className="text-zinc-300">http://</code> atau{" "}
                    <code className="text-zinc-300">https://</code>).
                  </div>
                </li>
              </ul>
            </div>

            {/* Tombol Aksi */}
            <div className="flex justify-end items-center gap-2.5 pt-2 border-t border-zinc-800/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/posts")}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!file || isUploading}
                onClick={handleUpload}
                className="text-xs min-w-[140px]"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Memproses CSV...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 mr-2" />
                    Proses File CSV
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
