/**
 * Platform Constraint Specifications and Real-time Validator
 *
 * Mendefinisikan spesifikasi dan batasan teknis dari masing-masing platform media sosial:
 * - Threads: Maksimal 500 karakter, teks mandiri atau media opsional hingga 10 item.
 * - TikTok: Maksimal 2.200 karakter, WAJIB menyertakan video untuk feed postingan.
 * - Instagram: Maksimal 2.200 karakter, WAJIB menyertakan media (gambar/video), maksimal 10 media carousel.
 * - Meta Facebook: Maksimal 63.206 karakter, teks fleksibel, media opsional.
 */

export type PlatformType = "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";

export interface PlatformSpec {
  platform: PlatformType;
  name: string;
  maxCharacters: number;
  requiresMedia: boolean;
  mediaTypeAllowed: "all" | "image_only" | "video_only";
  mediaRequirementNotice?: string;
  maxMediaCount: number;
  description: string;
}

export const PLATFORM_SPECS: Record<PlatformType, PlatformSpec> = {
  THREADS: {
    platform: "THREADS",
    name: "Threads",
    maxCharacters: 500,
    requiresMedia: false,
    mediaTypeAllowed: "all",
    maxMediaCount: 10,
    description: "Batas 500 karakter. Mendukung teks mandiri atau media hingga 10 item.",
  },
  TIKTOK: {
    platform: "TIKTOK",
    name: "TikTok",
    maxCharacters: 2200,
    requiresMedia: true,
    mediaTypeAllowed: "video_only",
    mediaRequirementNotice:
      "TikTok memerlukan file video (.mp4, .mov, .webm) untuk feed postingan.",
    maxMediaCount: 1,
    description: "Batas 2.200 karakter. Wajib menyertakan video feed vertikal.",
  },
  INSTAGRAM: {
    platform: "INSTAGRAM",
    name: "Instagram",
    maxCharacters: 2200,
    requiresMedia: true,
    mediaTypeAllowed: "all",
    mediaRequirementNotice:
      "Instagram memerlukan minimal 1 gambar atau video (tidak mendukung teks tanpa media).",
    maxMediaCount: 10,
    description:
      "Batas 2.200 karakter. Wajib menyertakan media (gambar atau video, maks 10 carousel).",
  },
  META_PAGE: {
    platform: "META_PAGE",
    name: "Facebook",
    maxCharacters: 63206,
    requiresMedia: false,
    mediaTypeAllowed: "all",
    maxMediaCount: 10,
    description: "Batas 63.206 karakter. Format teks bebas, media gambar/video opsional.",
  },
};

export type CharStatus = "safe" | "warning" | "exceeded";
export type MediaStatus = "valid" | "warning" | "error";

export interface PlatformValidationResult {
  platform: PlatformType;
  platformName: string;
  isValid: boolean;
  charCount: number;
  maxCharacters: number;
  remainingChars: number;
  charStatus: CharStatus;
  percentageUsed: number;
  mediaStatus: MediaStatus;
  hasMedia: boolean;
  hasVideo: boolean;
  hasImage: boolean;
  mediaCount: number;
  maxMediaCount: number;
  errors: string[];
  warnings: string[];
}

export interface MultiPlatformValidationSummary {
  allValid: boolean;
  hasBlockingErrors: boolean;
  hasWarnings: boolean;
  validations: PlatformValidationResult[];
  strictestCharLimit: {
    platform: PlatformType;
    platformName: string;
    maxCharacters: number;
    remainingChars: number;
    charCount: number;
    charStatus: CharStatus;
  } | null;
  blockingReasons: string[];
}

/**
 * Cek apakah URL media merupakan file video berdasarkan ekstensi file
 */
export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  return Boolean(url.match(/\.(mp4|mov|webm)(\?.*)?$/i));
}

/**
 * Validasi batasan satu platform secara realtime
 */
export function validatePlatformConstraints(
  platform: PlatformType,
  textContent: string,
  mediaUrls: string[] = []
): PlatformValidationResult {
  const spec = PLATFORM_SPECS[platform];
  const charCount = textContent.length;
  const maxCharacters = spec.maxCharacters;
  const remainingChars = maxCharacters - charCount;
  const percentageUsed = Math.min(100, Math.round((charCount / maxCharacters) * 100));

  let charStatus: CharStatus = "safe";
  if (remainingChars < 0) {
    charStatus = "exceeded";
  } else if (remainingChars <= 50 || percentageUsed >= 85) {
    charStatus = "warning";
  }

  const mediaCount = mediaUrls.length;
  const hasMedia = mediaCount > 0;
  const hasVideo = mediaUrls.some(isVideoUrl);
  const hasImage = mediaUrls.some((url) => !isVideoUrl(url));

  let mediaStatus: MediaStatus = "valid";
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validasi Batas Karakter
  if (remainingChars < 0) {
    errors.push(
      `Melebihi batas karakter ${spec.name} (${Math.abs(remainingChars)} karakter berlebih, maks ${maxCharacters.toLocaleString()})`
    );
  } else if (charStatus === "warning") {
    warnings.push(
      `Mendekati batas karakter ${spec.name} (sisa ${remainingChars} dari ${maxCharacters.toLocaleString()})`
    );
  }

  // Validasi Kebutuhan Media
  if (spec.requiresMedia) {
    if (!hasMedia) {
      mediaStatus = "error";
      errors.push(spec.mediaRequirementNotice || `${spec.name} memerlukan media.`);
    } else if (spec.mediaTypeAllowed === "video_only" && !hasVideo) {
      mediaStatus = "error";
      errors.push(
        `${spec.name} hanya mendukung media video. Harap sertakan file video (.mp4, .mov, .webm).`
      );
    }
  }

  // Validasi Batas Jumlah Media
  if (mediaCount > spec.maxMediaCount) {
    mediaStatus = "error";
    errors.push(
      `Jumlah media (${mediaCount}) melebihi batas maksimal ${spec.name} (maks ${spec.maxMediaCount} item)`
    );
  }

  // TikTok spesifik: hanya 1 video per postingan
  if (platform === "TIKTOK" && mediaCount > 1 && hasVideo) {
    warnings.push("TikTok hanya akan menggunakan 1 file video pertama untuk publikasi.");
  }

  const isValid = errors.length === 0;

  return {
    platform,
    platformName: spec.name,
    isValid,
    charCount,
    maxCharacters,
    remainingChars,
    charStatus,
    percentageUsed,
    mediaStatus,
    hasMedia,
    hasVideo,
    hasImage,
    mediaCount,
    maxMediaCount: spec.maxMediaCount,
    errors,
    warnings,
  };
}

/**
 * Validasi seluruh platform yang dipilih pengguna secara serempak
 */
export function validateMultiPlatformConstraints(
  selectedPlatforms: PlatformType[],
  textContent: string,
  mediaUrls: string[] = []
): MultiPlatformValidationSummary {
  if (selectedPlatforms.length === 0) {
    return {
      allValid: true,
      hasBlockingErrors: false,
      hasWarnings: false,
      validations: [],
      strictestCharLimit: null,
      blockingReasons: [],
    };
  }

  // Deduplicate platform
  const uniquePlatforms = Array.from(new Set(selectedPlatforms));
  const validations = uniquePlatforms.map((platform) =>
    validatePlatformConstraints(platform, textContent, mediaUrls)
  );

  const blockingReasons: string[] = [];
  let hasWarnings = false;

  validations.forEach((v) => {
    if (!v.isValid) {
      blockingReasons.push(...v.errors);
    }
    if (v.warnings.length > 0) {
      hasWarnings = true;
    }
  });

  const allValid = blockingReasons.length === 0;
  const hasBlockingErrors = !allValid;

  // Temukan batas karakter paling ketat di antara platform yang dipilih
  const sortedByLimit = [...validations].sort((a, b) => a.maxCharacters - b.maxCharacters);
  const strictest = sortedByLimit[0] ?? null;

  const strictestCharLimit = strictest
    ? {
        platform: strictest.platform,
        platformName: strictest.platformName,
        maxCharacters: strictest.maxCharacters,
        remainingChars: strictest.remainingChars,
        charCount: strictest.charCount,
        charStatus: strictest.charStatus,
      }
    : null;

  return {
    allValid,
    hasBlockingErrors,
    hasWarnings,
    validations,
    strictestCharLimit,
    blockingReasons,
  };
}
