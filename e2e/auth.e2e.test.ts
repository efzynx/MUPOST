import { test, expect } from "@playwright/test";

/**
 * E2E Test 16.1: Alur Registrasi dan Login
 * Requirements: 1.7, 2.2
 *
 * Test ini memerlukan server Next.js yang berjalan.
 * Jalankan: npm run dev (atau npm start) lalu npx playwright test
 */

// Periksa apakah server tersedia sebelum menjalankan test
async function isServerAvailable(baseURL: string): Promise<boolean> {
  try {
    const res = await fetch(baseURL, { signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

test.describe("E2E 16.1: Auth Flow — Registrasi dan Login", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL || "http://localhost:3000";
    const available = await isServerAvailable(baseURL);

    if (!available) {
      test.skip(
        true,
        `Server tidak tersedia di ${baseURL}. Jalankan 'npm run dev' terlebih dahulu.`
      );
      return;
    }

    // Mock API: register endpoint
    await page.route("**/api/auth/register", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.email && body?.password && body?.fullName) {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              userId: "mock-user-uuid-001",
              user: { id: "mock-user-uuid-001", email: body.email, fullName: body.fullName },
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 400,
          body: JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "Invalid data" } }),
        });
      }
    });

    // Mock API: login endpoint
    await page.route("**/api/auth/login", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.email === "test@mupost.com" && body?.password === "Password123!") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              user: { id: "mock-user-uuid-001", email: "test@mupost.com", fullName: "Test User" },
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 401,
          body: JSON.stringify({
            error: { code: "INVALID_CREDENTIALS", message: "Email atau kata sandi tidak valid." },
          }),
        });
      }
    });

    // Mock API: /api/auth/me
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            user: { id: "mock-user-uuid-001", email: "test@mupost.com", fullName: "Test User" },
          },
        }),
      });
    });

    // Mock API: /api/posts
    await page.route("**/api/posts*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { posts: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
        }),
      });
    });
  });

  test("Registrasi pengguna baru: form memuat dengan field yang benar", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByRole("heading", { name: /daftar|register|buat akun/i })).toBeVisible({
      timeout: 10000,
    });

    const nameField = page.getByLabel(/nama lengkap|full name/i);
    const emailField = page.getByLabel(/email/i);
    const passwordField = page.getByLabel(/kata sandi|password/i).first();

    await nameField.fill("Test User Baru");
    await emailField.fill("test@mupost.com");
    await passwordField.fill("Password123!");

    await expect(nameField).toHaveValue("Test User Baru");
    await expect(emailField).toHaveValue("test@mupost.com");
  });

  test("Halaman login: form email dan password berfungsi", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /masuk|login|selamat datang/i })).toBeVisible({
      timeout: 10000,
    });

    const emailField = page.getByLabel(/email/i);
    const passwordField = page.getByLabel(/kata sandi|password/i).first();

    await emailField.fill("test@mupost.com");
    await passwordField.fill("Password123!");

    await expect(emailField).toHaveValue("test@mupost.com");
    await expect(passwordField).toHaveValue("Password123!");
  });

  test("Navigasi ke /posts menampilkan daftar postingan", async ({ page }) => {
    await page.goto("/posts");

    await page.waitForLoadState("networkidle");

    const pageTitle = page.getByText(/postingan|posts|buat post/i).first();
    await expect(pageTitle).toBeVisible({ timeout: 10000 });
  });
});
