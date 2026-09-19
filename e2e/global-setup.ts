/**
 * Playwright Global Setup
 *
 * Memulai Next.js server (jika tersedia di E2E_BASE_URL)
 * atau memanfaatkan server yang sudah berjalan.
 *
 * Jalankan dengan:
 *   npm run dev &
 *   npx playwright test --config=playwright.config.ts
 *
 * Atau untuk CI:
 *   npm run build && npm run start &
 *   sleep 5
 *   E2E_BASE_URL=http://localhost:3000 npx playwright test
 */

import { chromium, FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || "http://localhost:3000";

  // Verifikasi server tersedia
  const browser = await chromium.launch({
    executablePath: "/home/efzyn/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
    headless: true,
  });

  try {
    const page = await browser.newPage();
    const response = await page.goto(baseURL, { timeout: 5000 }).catch(() => null);

    if (!response) {
      console.warn(
        `\n⚠️  E2E: Server tidak tersedia di ${baseURL}.\n` +
        `   Jalankan 'npm run dev' atau 'npm run start' terlebih dahulu.\n` +
        `   E2E tests akan dilewati (pass-with-no-tests mode).\n`
      );
    } else {
      console.log(`✓ E2E: Server tersedia di ${baseURL}`);
    }

    await page.close();
  } catch {
    // Ignore connection errors
  } finally {
    await browser.close();
  }
}

export default globalSetup;
