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

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateClientSide = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.fullName = "Nama lengkap wajib diisi";
    } else if (fullName.length > 100) {
      errors.fullName = "Nama lengkap maksimal 100 karakter";
    }

    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!email.trim()) {
      errors.email = "Alamat email wajib diisi";
    } else if (email.length > 254 || !emailRegex.test(email.trim())) {
      errors.email = "Format email tidak valid";
    }

    if (!password) {
      errors.password = "Kata sandi wajib diisi";
    } else if (password.length < 8 || password.length > 128) {
      errors.password = "Kata sandi harus 8–128 karakter";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");

    if (!validateClientSide()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch<{
        success?: boolean;
        redirect?: string;
        error?: {
          code: string;
          message: string;
          details?: Record<string, string[]>;
        };
      }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) {
        if (response.data?.error?.details) {
          const mapped: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(response.data.error.details)) {
            if (msgs.length > 0) mapped[key] = msgs[0]!;
          }
          setFieldErrors(mapped);
        }
        setGeneralError(
          response.data?.error?.message ||
            "Pendaftaran gagal. Silakan periksa kembali data Anda."
        );
        setIsLoading(false);
        return;
      }

      router.push(response.data?.redirect || "/dashboard");
    } catch {
      setGeneralError(
        "Gagal menghubungi server. Silakan periksa koneksi internet Anda."
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 mb-3 shadow-lg shadow-black/40 select-none">
            <MupostLogo className="w-full h-full text-zinc-100" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Mupost
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Buat akun baru untuk mulai menjadwalkan konten
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border-zinc-800 bg-zinc-900/60 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Daftar Akun Baru</CardTitle>
            <CardDescription className="text-xs">
              Lengkapi formulir di bawah ini untuk membuat akun
            </CardDescription>
          </CardHeader>

          <CardContent>
            {generalError && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{generalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-xs font-medium text-zinc-300 mb-1.5"
                >
                  Nama Lengkap
                </label>
                <Input
                  id="fullName"
                  type="text"
                  required
                  placeholder="Nama Lengkap"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  error={Boolean(fieldErrors.fullName)}
                />
                {fieldErrors.fullName && (
                  <p className="text-red-400 text-xs mt-1">
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-zinc-300 mb-1.5"
                >
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
                  error={Boolean(fieldErrors.email)}
                />
                {fieldErrors.email && (
                  <p className="text-red-400 text-xs mt-1">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-zinc-300 mb-1.5"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Minimal 8 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={Boolean(fieldErrors.password)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-0.5"
                    tabIndex={-1}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p className="text-red-400 text-xs mt-1">
                    {fieldErrors.password}
                  </p>
                ) : (
                  <p className="text-zinc-500 text-[11px] mt-1">
                    Gunakan 8 hingga 128 karakter.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isLoading}
              >
                Daftar Akun
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pt-2 border-t border-zinc-800/80 flex justify-center text-xs text-zinc-400">
            Sudah memiliki akun?{" "}
            <Link
              href="/login"
              className="ml-1 text-zinc-200 hover:text-white font-medium underline underline-offset-4 transition-colors"
            >
              Masuk di sini
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
