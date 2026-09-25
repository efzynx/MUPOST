/**
 * Client-Side Image Pre-Compression Utility
 * Memanfaatkan browser HTML5 Canvas API untuk mengompresi gambar sebelum diupload.
 */

export interface ImageCompressionOptions {
  /** Maksimal lebar gambar (proporsional), default 1920px */
  maxWidth?: number;
  /** Maksimal tinggi gambar (proporsional), default 1920px */
  maxHeight?: number;
  /** Kualitas output kompresi (0.0 - 1.0), default 0.85 */
  quality?: number;
  /** Format output yang diinginkan: 'image/webp' | 'image/jpeg' */
  format?: "image/webp" | "image/jpeg";
  /** Callback untuk memantau progres kompresi (0 - 100%) */
  onProgress?: (progress: number) => void;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Menghitung dimensi baru secara proporsional sesuai batas maxWidth dan maxHeight.
 */
export function calculateProportionalDimensions(
  width: number,
  height: number,
  maxWidth = 1920,
  maxHeight = 1920
): ImageDimensions {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }

  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  const widthRatio = maxWidth / width;
  const heightRatio = maxHeight / height;
  const ratio = Math.min(widthRatio, heightRatio);

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Mengecek apakah file merupakan gambar yang didukung untuk dikompresi.
 * Melewati file video atau format yang tidak didukung (GIF, SVG, dsb).
 */
export function isCompressibleImage(file: File): boolean {
  if (!file || typeof file.type !== "string") {
    return false;
  }

  // Hanya proses MIME image/*
  if (!file.type.startsWith("image/")) {
    return false;
  }

  // Lewati GIF (animasi), SVG (vektor), dan icon
  if (file.type === "image/gif" || file.type === "image/svg+xml" || file.type === "image/x-icon") {
    return false;
  }

  return true;
}

/**
 * Menentukan format output yang optimal.
 */
export function resolveOutputFormat(
  file: File,
  requestedFormat?: "image/webp" | "image/jpeg"
): { format: "image/webp" | "image/jpeg"; extension: string } {
  if (requestedFormat) {
    return {
      format: requestedFormat,
      extension: requestedFormat === "image/webp" ? ".webp" : ".jpg",
    };
  }

  // Jika input aslinya WebP, pertahankan WebP
  if (file.type === "image/webp") {
    return { format: "image/webp", extension: ".webp" };
  }

  // Default ke JPEG untuk kompatibilitas maksimal ke seluruh platform sosial
  return { format: "image/jpeg", extension: ".jpg" };
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      format,
      quality
    );
  });
}

/**
 * Mengompresi file gambar menggunakan HTML5 Canvas API di browser.
 * Jika file adalah video atau format tidak didukung, atau terjadi kendala,
 * fungsi akan mengembalikan file asli tanpa error.
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    format: requestedFormat,
    onProgress,
  } = options;

  // 1. Lewati jika bukan lingkungan browser
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  // 2. Lewati video atau format tidak didukung tanpa error
  if (!isCompressibleImage(file)) {
    return file;
  }

  try {
    onProgress?.(10);

    // 3. Muat gambar ke HTMLImageElement
    const image = await loadImageFromFile(file);
    onProgress?.(35);

    // 4. Hitung dimensi proporsional
    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    const { width: targetWidth, height: targetHeight } = calculateProportionalDimensions(
      originalWidth,
      originalHeight,
      maxWidth,
      maxHeight
    );

    // 5. Gambar ke Canvas
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }

    const { format: outputFormat, extension } = resolveOutputFormat(file, requestedFormat);

    // Jika JPEG, isi latar belakang putih untuk menangani transparansi PNG
    if (outputFormat === "image/jpeg") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    onProgress?.(65);

    // 6. Konversi ke Blob
    const blob = await canvasToBlob(canvas, outputFormat, quality);
    onProgress?.(90);

    if (!blob) {
      return file;
    }

    // 7. Jika kompresi tanpa resize menghasilkan file lebih besar, pertahankan file asli
    const wasResized = targetWidth !== originalWidth || targetHeight !== originalHeight;
    if (!wasResized && blob.size >= file.size && file.type === outputFormat) {
      onProgress?.(100);
      return file;
    }

    // 8. Buat File baru
    const originalName = file.name || "upload";
    const nameWithoutExt = originalName.replace(/\.[^.]+$/, "");
    const newFileName = `${nameWithoutExt}${extension}`;

    const compressedFile = new File([blob], newFileName, {
      type: outputFormat,
      lastModified: Date.now(),
    });

    onProgress?.(100);
    return compressedFile;
  } catch {
    // Lewati kesalahan kompresi tanpa memutus alur upload
    return file;
  }
}
