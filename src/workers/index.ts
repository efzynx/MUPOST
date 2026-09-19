import { createPublishWorker } from "./publish-worker";
import {
  createTokenRefreshWorker,
  setupTokenRefreshScanner,
} from "./token-refresh-worker";

/**
 * Entry point tunggal untuk menjalankan seluruh worker background Mupost:
 * 1. Post Publisher Worker (publish-queue)
 * 2. Token Refresh Worker (token-refresh-queue)
 * 3. Recurring Token Refresh Scanner (setiap 1 jam)
 */
export async function startWorkers() {
  // eslint-disable-next-line no-console
  console.log("=========================================");
  // eslint-disable-next-line no-console
  console.log("Memulai Mupost Background Workers...");
  // eslint-disable-next-line no-console
  console.log("=========================================");

  const publishWorker = createPublishWorker();
  // eslint-disable-next-line no-console
  console.log("[PublishWorker] Berjalan dan mendengarkan antrean publikasi.");

  const tokenRefreshWorker = createTokenRefreshWorker();
  // eslint-disable-next-line no-console
  console.log("[TokenRefreshWorker] Berjalan dan mendengarkan antrean refresh token.");

  try {
    await setupTokenRefreshScanner();
    // eslint-disable-next-line no-console
    console.log("[TokenRefreshScanner] Recurring scanner terjadwal setiap 1 jam aktif.");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[TokenRefreshScanner] Gagal mendaftarkan recurring scanner:", err);
  }

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n[Worker] Menerima sinyal ${signal}, melakukan graceful shutdown...`);
    try {
      await Promise.allSettled([
        publishWorker.close(),
        tokenRefreshWorker.close(),
      ]);
      // eslint-disable-next-line no-console
      console.log("[Worker] Seluruh worker telah dihentikan secara aman.");
      process.exit(0);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[Worker] Error saat menutup worker:", error);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return { publishWorker, tokenRefreshWorker };
}

if (require.main === module) {
  startWorkers().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[Worker] Gagal memulai worker:", err);
    process.exit(1);
  });
}
