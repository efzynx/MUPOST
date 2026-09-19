"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      setErrorMessage("Hanya file dengan ekstensi .csv yang diterima.");
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
    } catch (err: any) {
      setErrorMessage(
        err.message || "Terjadi kesalahan jaringan saat mengunggah file."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header & Navigasi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/posts"
              className="text-gray-500 hover:text-gray-700 transition flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Daftar Post
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Import Post via CSV
          </h1>
          <p className="text-sm text-gray-500">
            Unggah file CSV untuk membuat dan menjadwalkan banyak postingan secara sekaligus.
          </p>
        </div>

        <a
          href="/api/csv/template"
          download="mupost_template.csv"
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-gray-500" />
          Unduh Template CSV
        </a>
      </div>

      {/* Pesan Error Global */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <p className="font-medium">Proses Gagal</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Ringkasan Hasil Upload */}
      {summary && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                {summary.createdCount > 0 ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                )}
                <h2 className="text-lg font-semibold text-gray-900">
                  Ringkasan Pemrosesan CSV
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-xs font-medium text-green-800 uppercase tracking-wider">
                    Post Berhasil Dibuat
                  </p>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    {summary.createdCount}
                  </p>
                </div>

                <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">
                    Baris Dilewati / Error
                  </p>
                  <p className="text-2xl font-bold text-amber-900 mt-1">
                    {summary.skippedCount}
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs font-medium text-blue-800 uppercase tracking-wider">
                    Total Baris Data
                  </p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {summary.totalRows}
                  </p>
                </div>
              </div>

              {/* Tabel Laporan Error */}
              {summary.errors && summary.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Laporan Kesalahan Baris ({summary.errors.length})
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-24">
                            Baris
                          </th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-36">
                            Kolom
                          </th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                            Deskripsi Masalah
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {summary.errors.map((err, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-mono text-gray-700">
                              #{err.rowNumber}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-amber-700">
                              {err.column}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">
                              {err.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <Button
                  onClick={() => router.push("/posts")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Buka Daftar Postingan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null);
                    setSummary(null);
                    setErrorMessage(null);
                  }}
                >
                  Upload File Lain
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Box (jika belum ada summary atau ingin upload ulang) */}
      {!summary && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center ${
                dragActive
                  ? "border-indigo-500 bg-indigo-50/50"
                  : "border-gray-300 hover:border-indigo-400 bg-gray-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
                <Upload className="w-6 h-6" />
              </div>

              <p className="text-base font-medium text-gray-800 mb-1">
                Tarik dan lepas file CSV di sini, atau klik untuk memilih file
              </p>
              <p className="text-xs text-gray-500 max-w-sm">
                Maksimal 500 baris data per file. Ukuran berkas maksimal 5 MB.
              </p>
            </div>

            {/* File Terpilih */}
            {file && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Panduan Format Kolom CSV */}
            <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-lg space-y-2 text-xs text-blue-900">
              <p className="font-semibold flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-blue-700" />
                Format Kolom CSV yang Diperlukan:
              </p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 pl-1">
                <li>
                  <span className="font-mono font-semibold">platform</span>:{" "}
                  <code className="text-blue-900">facebook</code>,{" "}
                  <code className="text-blue-900">instagram</code>, atau{" "}
                  <code className="text-blue-900">tiktok</code>
                </li>
                <li>
                  <span className="font-mono font-semibold">scheduled_at</span>:{" "}
                  Format ISO 8601 di masa depan (contoh:{" "}
                  <code className="text-blue-900">2026-10-15T14:30:00Z</code>)
                </li>
                <li>
                  <span className="font-mono font-semibold">text_content</span>:{" "}
                  Teks konten postingan (maksimal 2.000 karakter)
                </li>
                <li>
                  <span className="font-mono font-semibold">media_url</span>:{" "}
                  URL gambar/video (opsional, diawali http:// atau https://)
                </li>
              </ul>
            </div>

            {/* Tombol Aksi */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/posts")}
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={!file || isUploading}
                onClick={handleUpload}
                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
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
