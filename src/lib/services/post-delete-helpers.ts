import type { PlatformType } from "@/lib/db/schema";

export interface DeleteTargetInfo {
  id?: string;
  connectedAccountId?: string;
  platform: PlatformType | string;
  status?: string;
  platformPostId?: string | null;
  accountName?: string;
}

export interface PostWithTargetsSummary {
  id: string;
  textContent?: string;
  status: string;
  targets?: DeleteTargetInfo[];
}

export interface PlatformDeleteResultSummary {
  targetId: string;
  platform: string;
  platformPostId: string | null;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  alreadyDeleted?: boolean;
  unsupported?: boolean;
}

/**
 * Memeriksa apakah postingan memiliki target yang sudah terbit di platform luar
 * atau berstatus PUBLISHED/PARTIAL.
 */
export function hasPublishedTargets(post?: PostWithTargetsSummary | null): boolean {
  if (!post) return false;
  if (post.status === "PUBLISHED" || post.status === "PARTIAL") return true;
  return Boolean(
    post.targets?.some(
      (t) => t.status === "PUBLISHED" || Boolean(t.platformPostId)
    )
  );
}

/**
 * Mengambil daftar target yang sudah berstatus PUBLISHED atau memiliki platformPostId.
 */
export function getPublishedTargets(post?: PostWithTargetsSummary | null): DeleteTargetInfo[] {
  if (!post?.targets) return [];
  return post.targets.filter(
    (t) => t.status === "PUBLISHED" || Boolean(t.platformPostId)
  );
}

/**
 * Mengembalikan label representasi platform yang ramah pengguna.
 */
export function formatPlatformDisplayName(platform: string): string {
  switch (platform) {
    case "META_PAGE":
      return "Facebook Page";
    case "INSTAGRAM":
      return "Instagram";
    case "TIKTOK":
      return "TikTok";
    case "THREADS":
      return "Threads";
    default:
      return platform;
  }
}

/**
 * Memformat pesan umpan balik setelah operasi penghapusan post dan sinkronisasi platform.
 */
export function formatDeleteFeedbackMessage(options: {
  deleteOnPlatforms: boolean;
  platformResults?: PlatformDeleteResultSummary[];
}): { type: "success" | "error" | "info"; message: string } {
  const { deleteOnPlatforms, platformResults } = options;

  if (!deleteOnPlatforms || !platformResults || platformResults.length === 0) {
    return {
      type: "success",
      message: "Postingan berhasil dihapus dari Mupost.",
    };
  }

  const successList = platformResults.filter((r) => r.success && !r.alreadyDeleted);
  const alreadyDeletedList = platformResults.filter((r) => r.alreadyDeleted);
  const unsupportedList = platformResults.filter((r) => r.unsupported);
  const failedList = platformResults.filter(
    (r) => !r.success && !r.alreadyDeleted && !r.unsupported
  );

  const parts: string[] = ["Postingan berhasil dihapus dari Mupost."];

  if (successList.length > 0) {
    const names = Array.from(new Set(successList.map((r) => formatPlatformDisplayName(r.platform))));
    parts.push(`Konten di ${names.join(", ")} berhasil dihapus.`);
  }

  if (alreadyDeletedList.length > 0) {
    const names = Array.from(new Set(alreadyDeletedList.map((r) => formatPlatformDisplayName(r.platform))));
    parts.push(`Konten di ${names.join(", ")} sudah dihapus sebelumnya dari platform.`);
  }

  if (unsupportedList.length > 0) {
    const names = Array.from(new Set(unsupportedList.map((r) => formatPlatformDisplayName(r.platform))));
    parts.push(`${names.join(", ")} tidak mendukung penghapusan otomatis via API.`);
  }

  if (failedList.length > 0) {
    const names = Array.from(new Set(failedList.map((r) => formatPlatformDisplayName(r.platform))));
    parts.push(`Gagal menghapus konten di ${names.join(", ")}.`);
    return {
      type: "info",
      message: parts.join(" "),
    };
  }

  return {
    type: "success",
    message: parts.join(" "),
  };
}
