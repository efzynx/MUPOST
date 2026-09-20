import Papa from "papaparse";
import { postManager, type PostWithTargets } from "./post-manager";
import { db } from "@/lib/db";
import { connectedAccounts, type PlatformType } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// ==========================================
// Konstanta
// ==========================================

export const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB = 5.242.880 bytes (Requirement 12.2)
export const MAX_CSV_ROWS = 500; // Maksimal 500 baris (Requirement 12.5)
export const MAX_TEXT_LENGTH = 2000; // Maksimal 2000 karakter per baris (Requirement 12.4)

export const ALLOWED_PLATFORMS = ["facebook", "instagram", "tiktok"] as const;
export type CsvPlatform = (typeof ALLOWED_PLATFORMS)[number];

// ==========================================
// Types
// ==========================================

export interface FileValidationInput {
  name: string;
  size: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface CsvRow {
  platform: CsvPlatform;
  scheduled_at: string; // ISO 8601
  text_content: string; // max 2000 chars
  media_url?: string; // valid URL jika diisi
}

export interface CsvValidationError {
  rowNumber: number;
  column: string;
  description: string;
}

export interface CsvParseResult {
  validRows: CsvRow[];
  invalidRows: CsvValidationError[];
  totalRows: number;
}

export interface BulkCreateResult {
  createdPosts: PostWithTargets[];
  skippedCount: number;
  errors: CsvValidationError[];
}

export class CsvProcessorError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "CsvProcessorError";
  }
}

// ==========================================
// Platform Mapping
// ==========================================

export const CSV_PLATFORM_MAP: Record<CsvPlatform, PlatformType> = {
  facebook: "META_PAGE",
  instagram: "INSTAGRAM",
  tiktok: "TIKTOK",
};

// ==========================================
// CSV Processor Service
// ==========================================

export class CsvProcessorService {
  /**
   * Validasi level file sebelum parsing:
   * 1. Ekstensi harus `.csv`
   * 2. Ukuran file tidak melebihi 5 MB (5.242.880 bytes)
   */
  validateFile(file: FileValidationInput): ValidationResult {
    if (!file || typeof file.name !== "string" || typeof file.size !== "number") {
      return {
        valid: false,
        error: {
          code: "INVALID_FILE",
          message: "Data file tidak valid.",
        },
      };
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".csv")) {
      return {
        valid: false,
        error: {
          code: "INVALID_FILE_FORMAT",
          message: "Hanya file berformat CSV yang diterima.",
        },
      };
    }

    if (file.size > MAX_CSV_SIZE_BYTES) {
      return {
        valid: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: "Ukuran file CSV tidak boleh melebihi 5 MB.",
        },
      };
    }

    return { valid: true };
  }

  /**
   * Mem-parse isi CSV dan memvalidasi setiap baris.
   * Memeriksa batas <= 500 baris sebelum memproses konten per baris.
   */
  async parseAndValidate(csvContent: string): Promise<CsvParseResult> {
    if (!csvContent || csvContent.trim().length === 0) {
      throw new CsvProcessorError("EMPTY_FILE", 400, "File CSV kosong atau tidak memiliki data.");
    }

    const parsed = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: "greedy",
    });

    const rawRows = parsed.data;
    const totalRows = rawRows.length;

    // Batas maksimal 500 baris (Requirement 12.5)
    if (totalRows > MAX_CSV_ROWS) {
      throw new CsvProcessorError(
        "EXCEEDS_ROW_LIMIT",
        400,
        `File CSV melebihi batas maksimal ${MAX_CSV_ROWS} baris (ditemukan ${totalRows} baris).`
      );
    }

    const validRows: CsvRow[] = [];
    const invalidRows: CsvValidationError[] = [];

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2; // Baris 1 adalah header, data mulai baris 2
      const rowErrors: CsvValidationError[] = [];

      // 1. Validasi Platform
      const rawPlatform = (row.platform || "").trim().toLowerCase();
      if (!ALLOWED_PLATFORMS.includes(rawPlatform as CsvPlatform)) {
        rowErrors.push({
          rowNumber,
          column: "platform",
          description: `Platform "${row.platform || ""}" tidak dikenali. Harus salah satu dari: facebook, instagram, tiktok.`,
        });
      }

      // 2. Validasi Scheduled At (ISO 8601 dan masa mendatang)
      const rawScheduledAt = (row.scheduled_at || "").trim();
      if (rawScheduledAt) {
        const parsedDate = new Date(rawScheduledAt);
        const timeVal = parsedDate.getTime();
        // Cek apakah format valid date dan di masa mendatang
        if (!isNaN(timeVal)) {
          const now = Date.now();
          if (timeVal <= now) {
            rowErrors.push({
              rowNumber,
              column: "scheduled_at",
              description: "Waktu jadwal publikasi harus berada di masa mendatang.",
            });
          }
        } else {
          rowErrors.push({
            rowNumber,
            column: "scheduled_at",
            description:
              "Format waktu jadwal tidak valid. Gunakan format ISO 8601 (contoh: 2026-10-01T10:00:00Z).",
          });
        }
      } else {
        rowErrors.push({
          rowNumber,
          column: "scheduled_at",
          description: "Waktu jadwal (scheduled_at) wajib diisi.",
        });
      }

      // 3. Validasi Text Content (tidak kosong, maks 2000 chars)
      const rawText = (row.text_content || "").trim();
      if (!rawText) {
        rowErrors.push({
          rowNumber,
          column: "text_content",
          description: "Konten teks tidak boleh kosong.",
        });
      } else if (rawText.length > MAX_TEXT_LENGTH) {
        rowErrors.push({
          rowNumber,
          column: "text_content",
          description: `Konten teks maksimal ${MAX_TEXT_LENGTH} karakter (saat ini ${rawText.length} karakter).`,
        });
      }

      // 4. Validasi Media URL (opsional, jika diisi harus URL valid)
      const rawMediaUrl = (row.media_url || "").trim();
      let isValidUrl = true;
      if (rawMediaUrl) {
        try {
          const parsedUrl = new URL(rawMediaUrl);
          if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            isValidUrl = false;
          }
        } catch {
          isValidUrl = false;
        }

        if (!isValidUrl) {
          rowErrors.push({
            rowNumber,
            column: "media_url",
            description: "URL media tidak valid. Gunakan URL http/https yang valid.",
          });
        }
      }

      // Jika ada error pada baris ini, masukkan ke invalidRows
      if (rowErrors.length > 0) {
        invalidRows.push(...rowErrors);
      } else {
        validRows.push({
          platform: rawPlatform as CsvPlatform,
          scheduled_at: rawScheduledAt,
          text_content: rawText,
          media_url: rawMediaUrl || undefined,
        });
      }
    });

    return {
      validRows,
      invalidRows,
      totalRows,
    };
  }

  /**
   * Membuat satu post dari satu baris CsvRow (digunakan untuk round-trip equivalence).
   */
  async createFromRow(row: CsvRow, userId: string): Promise<PostWithTargets> {
    const targetPlatform = CSV_PLATFORM_MAP[row.platform];

    // Ambil connected account aktif user untuk platform tersebut
    const [account] = await db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, userId),
          eq(connectedAccounts.platform, targetPlatform),
          eq(connectedAccounts.status, "ACTIVE")
        )
      )
      .limit(1);

    if (!account) {
      throw new CsvProcessorError(
        "NO_CONNECTED_ACCOUNT",
        422,
        `Akun ${row.platform} aktif tidak ditemukan untuk user. Silakan hubungkan akun terlebih dahulu.`
      );
    }

    return await postManager.createPost(userId, {
      textContent: row.text_content,
      mediaUrls: row.media_url ? [row.media_url] : undefined,
      targetAccountIds: [account.id],
      scheduledAt: new Date(row.scheduled_at),
      source: "CSV",
    });
  }

  /**
   * Mengonversi baris-baris CSV yang valid menjadi postingan di database via PostManager.
   */
  async createPostsFromRows(validRows: CsvRow[], userId: string): Promise<BulkCreateResult> {
    const createdPosts: PostWithTargets[] = [];
    const errors: CsvValidationError[] = [];
    let skippedCount = 0;

    // Ambil semua akun aktif user
    const userAccounts = await db
      .select({
        id: connectedAccounts.id,
        platform: connectedAccounts.platform,
      })
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.status, "ACTIVE")));

    const platformAccountMap: Partial<Record<PlatformType, string>> = {};
    for (const acc of userAccounts) {
      if (!platformAccountMap[acc.platform]) {
        platformAccountMap[acc.platform] = acc.id;
      }
    }

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      if (!row) continue;
      const targetPlatform = CSV_PLATFORM_MAP[row.platform];
      const accountId = platformAccountMap[targetPlatform];

      if (!accountId) {
        skippedCount++;
        errors.push({
          rowNumber: i + 2,
          column: "platform",
          description: `Tidak ditemukan akun aktif untuk platform ${row.platform}. Post dilewati.`,
        });
        continue;
      }

      try {
        const newPost = await postManager.createPost(userId, {
          textContent: row.text_content,
          mediaUrls: row.media_url ? [row.media_url] : undefined,
          targetAccountIds: [accountId],
          scheduledAt: new Date(row.scheduled_at),
          source: "CSV",
        });
        createdPosts.push(newPost);
      } catch (err: any) {
        skippedCount++;
        errors.push({
          rowNumber: i + 2,
          column: "general",
          description: err.message || "Gagal membuat postingan.",
        });
      }
    }

    return {
      createdPosts,
      skippedCount,
      errors,
    };
  }

  /**
   * Menghasilkan string template CSV beserta header dan baris contoh.
   */
  getTemplateCsv(): string {
    const sampleFutureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return (
      `platform,scheduled_at,text_content,media_url\r\n` +
      `facebook,${sampleFutureDate},"Halo dunia! Ini adalah contoh postingan dari template CSV Mupost.","https://example.com/image.jpg"\r\n` +
      `instagram,${sampleFutureDate},"Postingan Instagram dengan jadwal publikasi otomatis.","https://example.com/photo.png"\r\n` +
      `tiktok,${sampleFutureDate},"Video teaser promosi produk Mupost.","https://example.com/video.mp4"\r\n`
    );
  }
}

export const csvProcessor = new CsvProcessorService();
