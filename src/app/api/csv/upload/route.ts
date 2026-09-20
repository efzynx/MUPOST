import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { csvProcessor, CsvProcessorError } from "@/lib/services/csv-processor";

/**
 * POST /api/csv/upload
 * Memproses unggahan file CSV untuk bulk post creation.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sesi berakhir." } },
      { status: 401 }
    );
  }

  const user = await authService.validateSession(sessionCookie);
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_FILE",
            message: "File CSV wajib diunggah.",
          },
        },
        { status: 400 }
      );
    }

    const fileName = (file as any).name || "upload.csv";
    const fileSize = file.size;

    // 1. Validasi level file (ekstensi & ukuran <= 5MB)
    const fileValidation = csvProcessor.validateFile({
      name: fileName,
      size: fileSize,
    });

    if (!fileValidation.valid) {
      return NextResponse.json(
        {
          error: fileValidation.error,
        },
        { status: 400 }
      );
    }

    // 2. Baca isi teks CSV
    const csvContent = await file.text();

    // 3. Parse dan validasi setiap baris (maks 500 baris)
    const parseResult = await csvProcessor.parseAndValidate(csvContent);

    // 4. Jika tidak ada satu baris pun yang valid (Requirement 12.9)
    if (parseResult.validRows.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "NO_VALID_ROWS",
            message:
              "Tidak ada baris valid yang dapat diproses dari file CSV ini. Tidak ada post yang dibuat.",
            details: {
              totalRows: parseResult.totalRows,
              invalidRows: parseResult.invalidRows,
            },
          },
        },
        { status: 422 }
      );
    }

    // 5. Buat postingan untuk baris-baris yang valid (partial success didukung)
    const bulkResult = await csvProcessor.createPostsFromRows(parseResult.validRows, user.id);

    const allErrors = [...parseResult.invalidRows, ...bulkResult.errors];

    return NextResponse.json(
      {
        data: {
          createdCount: bulkResult.createdPosts.length,
          skippedCount: parseResult.invalidRows.length + bulkResult.skippedCount,
          totalRows: parseResult.totalRows,
          createdPosts: bulkResult.createdPosts.map((p) => ({
            id: p.id,
            status: p.status,
            scheduledAt: p.scheduledAt,
            textContent: p.textContent,
          })),
          errors: allErrors,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof CsvProcessorError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        },
        { status: err.statusCode }
      );
    }

    console.error("[CsvUpload] Error saat memproses file CSV:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Terjadi kesalahan internal saat memproses file CSV.",
        },
      },
      { status: 500 }
    );
  }
}
