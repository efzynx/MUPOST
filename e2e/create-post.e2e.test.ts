import { test, expect } from "@playwright/test";

/**
 * E2E Test 16.2: Create dan Publish Post
 * Requirements: 6.9
 */

async function isServerAvailable(baseURL: string): Promise<boolean> {
  try {
    const res = await fetch(baseURL, { signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

test.describe("E2E 16.2: Create dan Publish Post", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL || "http://localhost:3000";
    const available = await isServerAvailable(baseURL);

    if (!available) {
      test.skip(true, `Server tidak tersedia di ${baseURL}.`);
      return;
    }

    // Mock connected accounts
    await page.route("**/api/connect/accounts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "acct-001",
              platform: "META_PAGE",
              accountName: "My Facebook Page",
              status: "ACTIVE",
            },
          ],
        }),
      });
    });

    // Mock create post
    await page.route("**/api/posts", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: "post-001",
              textContent: body?.textContent || "Test post",
              status: body?.publishNow ? "QUEUED" : "DRAFT",
              scheduledAt: null,
              targets: [{ id: "tgt-001", platform: "META_PAGE", status: "PENDING" }],
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { posts: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
          }),
        });
      }
    });
  });

  test("Halaman buat post memiliki input teks dan tombol simpan", async ({ page }) => {
    await page.goto("/posts/new");

    await page.waitForLoadState("networkidle");

    const textareaOrInput = page.locator("textarea, input[type='text']").first();
    await expect(textareaOrInput).toBeVisible({ timeout: 10000 });

    const actionButton = page.getByRole("button", { name: /simpan|draft|publikas/i }).first();
    await expect(actionButton).toBeVisible({ timeout: 10000 });
  });

  test("Halaman daftar post memiliki tombol Buat Post dan Import CSV", async ({ page }) => {
    await page.route("**/api/posts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { posts: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
        }),
      });
    });

    await page.goto("/posts");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /buat post/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /import csv/i })).toBeVisible({ timeout: 10000 });
  });
});
