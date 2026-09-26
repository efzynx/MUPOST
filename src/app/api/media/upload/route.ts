import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import {
  validateImage,
  validateVideo,
  uploadMedia,
  detectMimeFromBytes,
  VALID_IMAGE_MIMES,
  VALID_VIDEO_MIMES,
  type FileInput,
} from "@/lib/services/media-uploader";

/**
 * POST /api/media/upload
 *
 * Menerima multipart/form-data dengan field "file".
 * Deteksi MIME dari magic bytes, validasi tipe + ukuran,
 * upload ke S3, kembalikan URL dan metadata.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Validasi sesi
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sesi berakhir atau tidak ditemukan." } },
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

  // 2. Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Request body harus multipart/form-data." } },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: { code: "MISSING_FILE", message: 'Field "file" wajib diisi.' } },
      { status: 400 }
    );
  }

  // 3. Baca file buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    return NextResponse.json(
      { error: { code: "EMPTY_FILE", message: "File kosong." } },
      { status: 400 }
    );
  }

  // 4. Deteksi MIME dari magic bytes
  const detectedMime = detectMimeFromBytes(buffer);

  const fileInput: FileInput = {
    buffer,
    originalName: file.name || "upload",
    declaredMimeType: file.type,
  };

  // 5. Validasi berdasarkan tipe media
  const isImage = detectedMime !== null && VALID_IMAGE_MIMES.has(detectedMime);
  const isVideo = detectedMime !== null && VALID_VIDEO_MIMES.has(detectedMime);

  if (!isImage && !isVideo) {
    return NextResponse.json(
      {
        error: {
          code: "UNSUPPORTED_FORMAT",
          message:
            "Format file tidak didukung. Upload gambar (JPEG, PNG, GIF, WebP) atau video (MP4, MOV).",
        },
      },
      { status: 400 }
    );
  }

  const validation = isImage ? validateImage(fileInput) : validateVideo(fileInput);

  if (!validation.valid) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: validation.error } },
      { status: 400 }
    );
  }

  // 6. Upload ke S3
  try {
    const result = await uploadMedia(
      buffer,
      { mimeType: validation.mimeType!, originalName: fileInput.originalName },
      user.id
    );

    return NextResponse.json(
      {
        url: result.publicUrl,
        key: result.key,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[MediaUpload] Upload gagal:", err);
    return NextResponse.json(
      { error: { code: "UPLOAD_FAILED", message: "Gagal mengupload file. Coba lagi." } },
      { status: 500 }
    );
  }
}
