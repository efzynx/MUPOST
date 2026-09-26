"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { MupostLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Silakan masukkan email dan kata sandi.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch<{
        success?: boolean;
        redirect?: string;
        error?: { code: string; message: string };
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        setErrorMessage(response.data?.error?.message || "Email atau kata sandi tidak valid.");
        setIsLoading(false);
        return;
      }

      router.push(response.data?.redirect || "/dashboard");
    } catch {
      setErrorMessage("Gagal menghubungi server. Silakan periksa koneksi internet Anda.");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle variant="compact" />
      </div>
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 mb-3 shadow-lg shadow-black/40 select-none">
            <MupostLogo className="w-full h-full text-zinc-100" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Mupost</h1>
          <p className="text-xs text-zinc-400 mt-1">Platform manajemen posting multi-platform</p>
        </div>

        {/* Auth Card */}
        <Card className="border-zinc-800 bg-zinc-900/60 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Masuk ke Akun</CardTitle>
            <CardDescription className="text-xs">
              Masukkan kredensial Anda untuk melanjutkan ke dashboard
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Alamat Email
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nama@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="password" className="block text-xs font-medium text-zinc-300">
                    Kata Sandi
                  </label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-0.5"
                    tabIndex={-1}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
                Masuk
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pt-2 border-t border-zinc-800/80 flex justify-center text-xs text-zinc-400">
            Belum memiliki akun?{" "}
            <Link
              href="/register"
              className="ml-1 text-zinc-200 hover:text-white font-medium underline underline-offset-4 transition-colors"
            >
              Daftar sekarang
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
