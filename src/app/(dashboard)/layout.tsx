import React from "react";
import {
  DashboardSidebar,
  MobileHeader,
  MobileBottomNav,
} from "@/components/dashboard-nav";
import { OfflineBanner } from "@/components/OfflineBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      {/* Desktop Navigation Sidebar */}
      <DashboardSidebar />

      {/* Main Content Area */}
      <div className="flex-1 md:pl-60 flex flex-col min-h-screen">
        {/* Offline Banner jika koneksi terputus */}
        <OfflineBanner />

        {/* Mobile Header */}
        <MobileHeader />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-24 md:pb-8 max-w-6xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile Navigation Bottom Bar */}
        <MobileBottomNav />
      </div>
    </div>
  );
}
