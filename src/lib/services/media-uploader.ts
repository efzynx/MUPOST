import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

// ==========================================
// Konstanta
// ==========================================

const MAX_IMAGE_BYTES = 8_388_608; // 8 MB
const MAX_VIDEO_BYTES = 536_870_912; // 512 MB

/** Threshold di atas mana kita pakai multipart upload (5 MB). */
const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

const VALID_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif"]);

const VALID_VIDEO_MIMES = new Set(["video/mp4", "video/quicktime"]);

// Magic-byte signatures yang kita kenali.
// Urutan penting: pemeriksaan dilakukan sekuensial, hit pertama menang.
const SIGNATURES: Array<{ mime: string; offset: number; bytes: number[] }> = [
  // PNG: 89 50 4E 47
  { mime: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] },
  // GIF87a / GIF89a
  { mime: "image/gif", offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
  { mime: "image/gif", offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
  // JPEG: FF D8 FF
  { mime: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  // QuickTime harus dicek SEBELUM MP4 karena keduanya punya "ftyp" di offset 4.
  // QuickTime brand "qt  " → 6 byte signature lebih spesifik daripada 4 byte "ftyp".
  { mime: "video/quicktime", offset: 4, bytes: [0x66, 0x74, 0x79, 0x70, 0x71, 0x74] },
  // MP4 (ftyp box) — signature generik, cocok semua ftyp yang bukan QuickTime
  { mime: "video/mp4", offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
];

// ==========================================
// Types
// ==========================================

export interface FileInput {
  buffer: Buffer;
  originalName: string;
  /** MIME yang diklaim client — kita TIDAK percaya ini, hanya pakai sebagai fallback label. */
  declaredMimeType?: string;
}

export interface ValidationResult {
  valid: boolean;
  mimeType: string | null;
  sizeBytes: number;
  error?: string;
}

export interface UploadResult {
  key: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MediaMetadata {
  mimeType: string;
  originalName: string;
}

// ==========================================
// Helper internal
// ==========================================

/**
 * Deteksi MIME dari magic bytes buffer.
 * Kembalikan null jika tidak ada signature yang cocok.
 */
export function detectMimeFromBytes(buffer: Buffer): string | null {
  for (const sig of SIGNATURES) {
    if (buffer.length < sig.offset + sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[sig.offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return sig.mime;
  }
  return null;
}

/**
 * Ambil ekstensi dari MIME type.
 */
function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "video/mp4":
      return "mp4";
    case "video/quicktime":
      return "mov";
    default:
      return "bin";
  }
}

// ==========================================
// S3 Client — singleton
// ==========================================

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: true, // Wajib untuk MinIO / S3-compatible
    });
  }
  return s3Client;
}

/** Reset singleton — hanya untuk testing. */
export function resetS3Client(): void {
  s3Client = null;
}

// ==========================================
// Validasi
// ==========================================

/**
 * Validasi file gambar berdasarkan magic bytes dan ukuran.
 *
 * - Deteksi MIME dari magic bytes, bukan dari ekstensi atau header Content-Type.
 * - MIME harus salah satu dari: image/jpeg, image/png, image/gif.
 * - Ukuran file ≤ 8 MB (8_388_608 bytes).
 */
export function validateImage(file: FileInput): ValidationResult {
  const sizeBytes = file.buffer.length;
  const detectedMime = detectMimeFromBytes(file.buffer);

  if (!detectedMime) {
    return {
      valid: false,
      mimeType: null,
      sizeBytes,
      error: "Format file tidak dikenali. Upload gambar JPEG, PNG, atau GIF.",
    };
  }

  if (!VALID_IMAGE_MIMES.has(detectedMime)) {
    return {
      valid: false,
      mimeType: detectedMime,
      sizeBytes,
      error: `Tipe file ${detectedMime} tidak didukung. Upload gambar JPEG, PNG, atau GIF.`,
    };
  }

  if (sizeBytes > MAX_IMAGE_BYTES) {
    return {
      valid: false,
      mimeType: detectedMime,
      sizeBytes,
      error: `Ukuran gambar ${(sizeBytes / 1_048_576).toFixed(1)} MB melebihi batas 8 MB.`,
    };
  }

  return { valid: true, mimeType: detectedMime, sizeBytes };
}

/**
 * Validasi file video berdasarkan magic bytes dan ukuran.
 *
 * - Deteksi MIME dari magic bytes (ftyp box).
 * - MIME harus salah satu dari: video/mp4, video/quicktime.
 * - Ukuran file ≤ 512 MB (536_870_912 bytes).
 */
export function validateVideo(file: FileInput): ValidationResult {
  const sizeBytes = file.buffer.length;
  const detectedMime = detectMimeFromBytes(file.buffer);

  if (!detectedMime) {
    return {
      valid: false,
      mimeType: null,
      sizeBytes,
      error: "Format file tidak dikenali. Upload video MP4 atau MOV.",
    };
  }

  if (!VALID_VIDEO_MIMES.has(detectedMime)) {
    return {
      valid: false,
      mimeType: detectedMime,
      sizeBytes,
      error: `Tipe file ${detectedMime} tidak didukung. Upload video MP4 atau MOV.`,
    };
  }

  if (sizeBytes > MAX_VIDEO_BYTES) {
    return {
      valid: false,
      mimeType: detectedMime,
      sizeBytes,
      error: `Ukuran video ${(sizeBytes / 1_048_576).toFixed(1)} MB melebihi batas 512 MB.`,
    };
  }

  return { valid: true, mimeType: detectedMime, sizeBytes };
}

// ==========================================
// Upload & Presigned URL
// ==========================================

/**
 * Upload file ke S3 dengan path `media/{userId}/{year}/{month}/{uuid}.{ext}`.
 *
 * File > 5 MB diupload via multipart (AWS SDK Upload class).
 * File ≤ 5 MB diupload via PutObjectCommand.
 */
export async function uploadMedia(
  buffer: Buffer,
  metadata: MediaMetadata,
  userId: string
): Promise<UploadResult> {
  const client = getS3Client();
  const bucket = env.S3_BUCKET;

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const fileId = randomUUID();
  const ext = extFromMime(metadata.mimeType);
  const key = `media/${userId}/${year}/${month}/${fileId}.${ext}`;

  try {
    if (buffer.length > MULTIPART_THRESHOLD) {
      // Multipart upload untuk file besar
      const upload = new Upload({
        client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: metadata.mimeType,
          Metadata: {
            "original-name": metadata.originalName,
          },
        },
        queueSize: 4,
        partSize: MULTIPART_THRESHOLD,
      });

      await upload.done();
    } else {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: metadata.mimeType,
          Metadata: {
            "original-name": metadata.originalName,
          },
        })
      );
    }
  } catch (err: any) {
    if (err.name === "NoSuchBucket" || err.Code === "NoSuchBucket") {
      try {
        const { CreateBucketCommand, PutBucketPolicyCommand } = await import("@aws-sdk/client-s3");
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        const policy = JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PublicRead",
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        });
        await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }));
        // Retry upload setelah bucket dibuat
        return await uploadMedia(buffer, metadata, userId);
      } catch (createErr) {
        console.warn("[MediaUploader] Auto create bucket failed:", createErr);
      }
    }
    throw err;
  }

  // Buat public URL — untuk S3 compatible (MinIO) pakai endpoint + bucket + key
  // Jika S3 berjalan di localhost tapi NEXT_PUBLIC_APP_URL tersedia (misal via ngrok),
  // gunakan NEXT_PUBLIC_APP_URL agar media bisa diakses dari luar (Meta/TikTok & mobile PWA)
  // serta menghindari Mixed Content error (HTTPS ngrok memanggil HTTP localhost)
  const endpoint = env.S3_ENDPOINT.replace(/\/$/, "");
  const isLocalEndpoint = endpoint.includes("localhost") || endpoint.includes("127.0.0.1");
  const baseDomain =
    isLocalEndpoint && env.NEXT_PUBLIC_APP_URL
      ? env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
      : endpoint;
  const publicUrl = `${baseDomain}/${bucket}/${key}`;

  return {
    key,
    publicUrl,
    mimeType: metadata.mimeType,
    sizeBytes: buffer.length,
  };
}

/**
 * Buat presigned GET URL untuk mengakses file di S3.
 *
 * @param key - S3 object key
 * @param expiresIn - durasi validitas URL dalam detik (default 3600 = 1 jam)
 */
export async function generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const client = getS3Client();
  const bucket = env.S3_BUCKET;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

// ==========================================
// Ekspor konstanta untuk testing
// ==========================================

export { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VALID_IMAGE_MIMES, VALID_VIDEO_MIMES };
