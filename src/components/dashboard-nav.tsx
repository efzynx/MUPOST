"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  PlusSquare,
  Plus,
  UploadCloud,
  Share2,
  LogOut,
  Activity,
  MoreHorizontal,
  X,
  ChevronRight,
} from "lucide-react";
import { MupostLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Ringkasan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Postingan", href: "/posts", icon: FileText },
  { label: "Buat Post", href: "/posts/new", icon: PlusSquare },
  { label: "Import CSV", href: "/posts/import", icon: UploadCloud },
  { label: "Koneksi Akun", href: "/settings/connections", icon: Share2 },
  { label: "Antrean Worker", href: "/admin/queues", icon: Activity },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 z-30 border-r border-zinc-800/80 bg-zinc-950">
      {/* Brand */}
      <div className="flex h-14 items-center px-5 border-b border-zinc-800/80 gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 p-1.5 shadow-sm select-none">
          <MupostLogo className="w-full h-full text-zinc-100" />
        </div>
        <span className="font-semibold text-sm tracking-tight text-zinc-100">Mupost</span>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/posts"
              ? pathname === "/posts" ||
                (pathname.startsWith("/posts/") &&
                  !NAV_ITEMS.some(
                    (n) =>
                      n.href !== "/posts" && (pathname === n.href || pathname.startsWith(n.href))
                  ))
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors select-none",
                isActive
                  ? "bg-zinc-900 text-zinc-100 border border-zinc-800 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
              )}
            >
              <Icon
                className={cn("w-4 h-4 shrink-0", isActive ? "text-zinc-100" : "text-zinc-500")}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile / Theme / Logout */}
      <div className="p-3 border-t border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between px-2.5 py-1">
          <span className="text-xs font-medium text-zinc-400">Tema</span>
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-zinc-900/50 transition-colors disabled:opacity-50 select-none"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>{isLoggingOut ? "Keluar..." : "Keluar Sesi"}</span>
        </button>
      </div>
    </aside>
  );
}

export function MobileHeader() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      // noop
    }
  };

  return (
    <header className="md:hidden flex h-14 items-center justify-between px-4 border-b border-zinc-800/80 bg-zinc-950 sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 p-1.5 shadow-sm select-none">
          <MupostLogo className="w-full h-full text-zinc-100" />
        </div>
        <span className="font-semibold text-sm tracking-tight text-zinc-100">Mupost</span>
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle variant="compact" />
        <button
          onClick={handleLogout}
          className="text-zinc-400 hover:text-zinc-200 p-2 rounded-md transition-colors"
          aria-label="Keluar"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Auto-close more sheet on route change
  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  // Lock body scroll and handle Escape key when sheet is open
  useEffect(() => {
    if (!isMoreOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMoreOpen(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMoreOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      setIsMoreOpen(false);
      router.push("/login");
    } catch {
      setIsLoggingOut(false);
    }
  };

  const isDashboardActive = pathname === "/dashboard";
  const isPostsActive =
    pathname === "/posts" ||
    (pathname.startsWith("/posts/") &&
      !pathname.startsWith("/posts/new") &&
      !pathname.startsWith("/posts/import"));
  const isCreateActive = pathname === "/posts/new" || pathname.startsWith("/posts/new/");
  const isConnectionsActive =
    pathname === "/settings/connections" || pathname.startsWith("/settings/connections");
  const isMoreActive =
    pathname === "/posts/import" ||
    pathname.startsWith("/posts/import/") ||
    pathname === "/admin/queues" ||
    pathname.startsWith("/admin/queues/") ||
    (pathname.startsWith("/settings/") && !isConnectionsActive);

  return (
    <>
      <nav
        aria-label="Navigasi Bawah Mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-zinc-950 border-t border-zinc-800/80 safe-area-pb"
      >
        <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1">
          {/* 1. Ringkasan */}
          <Link
            href="/dashboard"
            aria-label="Ringkasan Dashboard"
            aria-current={isDashboardActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center h-full w-full py-1 rounded-xl transition-all duration-150 select-none touch-manipulation group",
              isDashboardActive
                ? "text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <LayoutDashboard
              className={cn(
                "w-5 h-5 transition-transform duration-150 group-active:scale-90",
                isDashboardActive ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-200"
              )}
            />
            <span className="text-[10px] mt-1 tracking-tight leading-none">Ringkasan</span>
          </Link>

          {/* 2. Postingan */}
          <Link
            href="/posts"
            aria-label="Daftar Postingan"
            aria-current={isPostsActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center h-full w-full py-1 rounded-xl transition-all duration-150 select-none touch-manipulation group",
              isPostsActive ? "text-zinc-100 font-semibold" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <FileText
              className={cn(
                "w-5 h-5 transition-transform duration-150 group-active:scale-90",
                isPostsActive ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-200"
              )}
            />
            <span className="text-[10px] mt-1 tracking-tight leading-none">Postingan</span>
          </Link>

          {/* 3. Buat Post (Tombol Aksi Utama di Tengah) */}
          <Link
            href="/posts/new"
            aria-label="Buat Post Baru"
            aria-current={isCreateActive ? "page" : undefined}
            className="flex flex-col items-center justify-center h-full w-full py-1 select-none touch-manipulation group"
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 shadow-md",
                isCreateActive
                  ? "bg-zinc-100 text-zinc-950 ring-2 ring-zinc-400 ring-offset-2 ring-offset-zinc-950 scale-105"
                  : "bg-zinc-100 text-zinc-950 group-hover:bg-white group-active:scale-95"
              )}
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span
              className={cn(
                "text-[10px] mt-0.5 tracking-tight leading-none font-semibold transition-colors",
                isCreateActive ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-200"
              )}
            >
              Buat Post
            </span>
          </Link>

          {/* 4. Koneksi */}
          <Link
            href="/settings/connections"
            aria-label="Koneksi Akun"
            aria-current={isConnectionsActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center h-full w-full py-1 rounded-xl transition-all duration-150 select-none touch-manipulation group",
              isConnectionsActive
                ? "text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Share2
              className={cn(
                "w-5 h-5 transition-transform duration-150 group-active:scale-90",
                isConnectionsActive ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-200"
              )}
            />
            <span className="text-[10px] mt-1 tracking-tight leading-none">Koneksi</span>
          </Link>

          {/* 5. Lainnya */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            aria-label="Menu navigasi lainnya"
            aria-expanded={isMoreOpen}
            aria-controls="mobile-more-sheet"
            className={cn(
              "flex flex-col items-center justify-center h-full w-full py-1 rounded-xl transition-all duration-150 select-none touch-manipulation group",
              isMoreActive || isMoreOpen
                ? "text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <div className="relative">
              <MoreHorizontal
                className={cn(
                  "w-5 h-5 transition-transform duration-150 group-active:scale-90",
                  isMoreActive || isMoreOpen
                    ? "text-zinc-100"
                    : "text-zinc-400 group-hover:text-zinc-200"
                )}
              />
              {isMoreActive && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-zinc-100 ring-2 ring-zinc-950" />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight leading-none">Lainnya</span>
          </button>
        </div>
      </nav>

      {/* Sheet Drawer Menu Lainnya */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Surface */}
          <div
            id="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-sheet-title"
            className="relative z-10 w-full bg-zinc-900 border-t border-zinc-800 rounded-t-2xl shadow-2xl p-4 pt-3 pb-6 safe-area-pb max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
          >
            {/* Grabber Handle */}
            <div className="flex justify-center pb-2">
              <div className="w-10 h-1 rounded-full bg-zinc-700/80" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 p-1 select-none">
                  <MupostLogo className="w-full h-full text-zinc-100" />
                </div>
                <div>
                  <h2 id="mobile-more-sheet-title" className="text-sm font-semibold text-zinc-100">
                    Menu & Fitur Lainnya
                  </h2>
                  <p className="text-[11px] text-zinc-400">Akses cepat manajemen dan pengaturan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                aria-label="Tutup menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigasi Sekunder */}
            <div className="py-3 space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-1 block">
                Fitur Tambahan
              </span>

              {/* Import CSV */}
              <Link
                href="/posts/import"
                onClick={() => setIsMoreOpen(false)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-colors touch-manipulation select-none",
                  pathname === "/posts/import"
                    ? "bg-zinc-800/90 border-zinc-700 text-zinc-100 shadow-sm"
                    : "bg-zinc-950/50 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200 shrink-0">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100">Import CSV</div>
                    <div className="text-[11px] text-zinc-400">
                      Unggah postingan terjadwal massal
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </Link>

              {/* Antrean Worker */}
              <Link
                href="/admin/queues"
                onClick={() => setIsMoreOpen(false)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-colors touch-manipulation select-none",
                  pathname === "/admin/queues"
                    ? "bg-zinc-800/90 border-zinc-700 text-zinc-100 shadow-sm"
                    : "bg-zinc-950/50 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-200 shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100">Antrean Worker</div>
                    <div className="text-[11px] text-zinc-400">
                      Monitoring status job & publikasi
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </Link>
            </div>

            {/* Tema & Sesi */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800/80">
                <div>
                  <span className="text-xs font-medium text-zinc-200 block">Tema Tampilan</span>
                  <span className="text-[11px] text-zinc-400">Pilih mode warna tampilan</span>
                </div>
                <ThemeToggle variant="segmented" />
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-950/40 hover:text-red-300 text-xs font-semibold transition-colors disabled:opacity-50 touch-manipulation"
              >
                <LogOut className="w-4 h-4" />
                <span>{isLoggingOut ? "Keluar..." : "Keluar Sesi"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
