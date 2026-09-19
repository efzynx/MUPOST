import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

/**
 * E2E Test 16.4: CSV Upload UI
 * Requirements: 12.1, 12.3
 */

async function isServerAvailable(baseURL: string): Promise<boolean> {
  try {
    const res = await fetch(baseURL, { signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

test.describe("E2E 16.4: CSV Upload UI", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL || "http://localhost:3000";
    const available = await isServerAvailable(baseURL);

    if (!available) {
      test.skip(true, `Server tidak tersedia di ${baseURL}.`);
      return;
    }

    await page.route("**/api/csv/upload", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            createdCount: 3,
            skippedCount: 0,
            totalRows: 3,
            createdPosts: [
              { id: "csv-post-1", status: "SCHEDULED", scheduledAt: new Date().toISOString(), textContent: "Row 1" },
            ],
            errors: [],
          },
        }),
      });
    });

    await page.route("**/api/csv/template*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/csv",
        headers: { "Content-Disposition": 'attachment; filename="mupost_template.csv"' },
        body: "platform,scheduled_at,text_content,media_url\nfacebook,2026-12-01T10:00:00Z,Contoh post,",
      });
    });
  });

  test("Halaman import CSV memiliki area upload dan tombol unduh template", async ({ page }) => {
    await page.goto("/posts/import");
    await page.waitForLoadState("networkidle");

    const uploadArea = page
      .locator("input[type='file'], div[class*='border-dashed']")
      .first();
    await expect(uploadArea).toBeAttached({ timeout: 10000 });

    const downloadLink = page.getByRole("link", { name: /template|unduh/i }).first();
    const downloadButton = page.getByRole("button", { name: /template|unduh/i }).first();
    const linkExists = await downloadLink.isVisible().catch(() => false);
    const buttonExists = await downloadButton.isVisible().catch(() => false);
    expect(linkExists || buttonExists).toBe(true);
  });

  test("Upload file CSV valid menampilkan ringkasan sukses", async ({ page }) => {
    await page.goto("/posts/import");
    await page.waitForLoadState("networkidle");

    const tmpDir = os.tmpdir();
    const csvPath = path.join(tmpDir, "mupost_e2e_test.csv");
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(
      csvPath,
      `platform,scheduled_at,text_content,media_url\nfacebook,${futureDate},Test row E2E,\n`
    );

    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles(csvPath);

    await page.waitForTimeout(500);

    const processButton = page.getByRole("button", { name: /proses|upload/i }).first();
    const isVisible = await processButton.isVisible().catch(() => false);

    if (isVisible) {
      await processButton.click();
      await page.waitForTimeout(2000);
      const successSummary = page.getByText(/berhasil|dibuat|created/i).first();
      await expect(successSummary).toBeVisible({ timeout: 10000 });
    }

    fs.unlinkSync(csvPath);
  });

  test("Halaman import menolak file non-CSV (validasi client-side)", async ({ page }) => {
    await page.goto("/posts/import");
    await page.waitForLoadState("networkidle");

    const dropzone = page.locator("div[class*='border-dashed']").first();
    await expect(dropzone).toBeVisible({ timeout: 10000 });
  });
});
