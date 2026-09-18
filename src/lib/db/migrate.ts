import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { getDb, getPool } from "./index";

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle/migrations");
  // eslint-disable-next-line no-console
  console.log(`Menjalankan migrasi dari ${migrationsFolder}...`);

  const dbInstance = getDb();
  await migrate(dbInstance, { migrationsFolder });

  // eslint-disable-next-line no-console
  console.log("Migrasi database berhasil diselesaikan.");
}

// Menjalankan langsung jika berkas dieksekusi sebagai script utama
if (require.main === module) {
  runMigrations()
    .then(async () => {
      await getPool().end();
      process.exit(0);
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error("Migrasi database gagal:", err);
      try {
        await getPool().end();
      } catch {
        // Abaikan error saat cleanup pool
      }
      process.exit(1);
    });
}
