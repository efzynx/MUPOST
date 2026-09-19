"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  PlusSquare,
  UploadCloud,
  Share2,
  LogOut,
} from "lucide-react";
import { MupostLogo } from "@/components/ui/logo";

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
        <span className="font-semibold text-sm tracking-tight text-zinc-100">
          Mupost
        </span>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

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
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-zinc-100" : "text-zinc-500")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile / Logout */}
      <div className="p-3 border-t border-zinc-800/80">
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
        <span className="font-semibold text-sm tracking-tight text-zinc-100">
          Mupost
        </span>
      </div>

      <button
        onClick={handleLogout}
        className="text-zinc-400 hover:text-zinc-200 p-2 rounded-md transition-colors"
        aria-label="Keluar"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur border-t border-zinc-800/80 flex justify-around items-center h-16 px-1 safe-area-pb">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center py-1 px-2 rounded-md min-w-[56px] transition-colors select-none",
              isActive ? "text-zinc-100 font-medium" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Icon className={cn("w-5 h-5", isActive ? "text-zinc-100" : "text-zinc-500")} />
            <span className="text-[10px] mt-1 tracking-tight leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
