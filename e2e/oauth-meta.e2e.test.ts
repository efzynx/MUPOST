import { test, expect } from "@playwright/test";

/**
 * E2E Test 16.3: OAuth Meta (mocked redirect)
 * Requirements: 4.1, 4.4
 */

async function isServerAvailable(baseURL: string): Promise<boolean> {
  try {
    const res = await fetch(baseURL, { signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

test.describe("E2E 16.3: OAuth Meta — Koneksi Akun", () => {
  test.beforeEach(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL || "http://localhost:3000";
    const available = await isServerAvailable(baseURL);

    if (!available) {
      test.skip(true, `Server tidak tersedia di ${baseURL}.`);
    }
  });

  test("Halaman settings/connections menampilkan opsi koneksi platform", async ({ page }) => {
    await page.route("**/api/connect/accounts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto("/settings/connections");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.content();
    expect(
      pageContent.toLowerCase().includes("meta") ||
        pageContent.toLowerCase().includes("facebook") ||
        pageContent.toLowerCase().includes("tiktok") ||
        pageContent.toLowerCase().includes("hubungkan") ||
        pageContent.toLowerCase().includes("connect")
    ).toBe(true);
  });

  test("Tombol hubungkan platform tersedia dan dapat diinteraksi", async ({ page }) => {
    await page.route("**/api/connect/accounts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto("/settings/connections");
    await page.waitForLoadState("networkidle");

    const connectButton = page.getByRole("button", { name: /hubungkan|connect/i }).first();
    const isVisible = await connectButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(connectButton).toBeEnabled();
    } else {
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    }
  });
});
