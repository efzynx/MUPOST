"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Share2, PlusSquare, UploadCloud, ArrowUpRight, CheckCircle2 } from "lucide-react";

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await apiFetch<{ user: UserProfile }>("/api/auth/me");
        if (res.ok && res.data?.user) {
          setUser(res.data.user);
        } else {
          router.push("/login");
        }
      } catch {
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        <div className="flex items-center gap-2.5 text-xs">
          <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          <span>Memuat ringkasan dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Ringkasan Dashboard
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Selamat datang kembali, <span className="text-zinc-200 font-medium">{user?.fullName}</span> ({user?.email})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="published" className="h-6">
            <CheckCircle2 className="w-3 h-3" />
            Sistem Siap
          </Badge>
        </div>
      </div>

      {/* Quick Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/settings/connections" className="group">
          <Card className="h-full hover:border-zinc-700 transition-colors">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                  <Share2 className="w-4 h-4" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
              </div>
              <CardTitle className="text-sm mt-3">Koneksi Platform</CardTitle>
              <CardDescription className="text-xs">
                Hubungkan akun Meta (Facebook Page & Instagram) dan TikTok untuk memulai posting.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/posts/new" className="group">
          <Card className="h-full hover:border-zinc-700 transition-colors">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
              </div>
              <CardTitle className="text-sm mt-3">Buat Postingan Baru</CardTitle>
              <CardDescription className="text-xs">
                Tulis konten, unggah media gambar atau video, dan jadwalkan ke berbagai platform.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/posts/import" className="group">
          <Card className="h-full hover:border-zinc-700 transition-colors">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
              </div>
              <CardTitle className="text-sm mt-3">Import Massal CSV</CardTitle>
              <CardDescription className="text-xs">
                Unggah spreadsheet CSV untuk menjadwalkan puluhan postingan sekaligus secara instan.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Status Info Box */}
      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-sm">Langkah Selanjutnya</CardTitle>
          <CardDescription className="text-xs">
            Untuk mulai menggunakan fitur publikasi otomatis:
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
            <li>
              Buka menu <Link href="/settings/connections" className="text-zinc-200 underline underline-offset-2">Koneksi Akun</Link> untuk mengotorisasi akun media sosial Anda via OAuth 2.0.
            </li>
            <li>
              Setelah akun terhubung, Anda dapat mempublikasikan konten langsung atau menyimpannya sebagai jadwal terencana.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
