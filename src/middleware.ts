import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS } from "@/lib/cookies";
import { generateCsrfToken, validateCsrfToken } from "@/lib/csrf";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Rute autentikasi tamu (halaman login & register)
const AUTH_PAGES = ["/login", "/register"];

// Rute aplikasi yang dilindungi (membutuhkan sesi login aktif)
const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/posts"];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // 1. Validasi untuk Endpoint API (/api/*)
  if (pathname.startsWith("/api/")) {
    const isWebhookOrCallback =
      pathname.startsWith("/api/auth/") ||
      pathname === "/api/connect/meta/callback" ||
      pathname === "/api/connect/tiktok/callback" ||
      pathname === "/api/connect/threads/callback" ||
      pathname === "/api/connect/threads/deauthorize" ||
      pathname === "/api/connect/threads/delete";

    // a. Validasi CSRF untuk metode mutasi (POST, PUT, PATCH, DELETE) kecuali webhook eksternal / callback
    if (MUTATING_METHODS.has(method) && !isWebhookOrCallback) {
      const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
      const csrfHeader = request.headers.get("x-csrf-token");

      if (!validateCsrfToken(csrfHeader, csrfCookie)) {
        return NextResponse.json(
          {
            error: {
              code: "CSRF_INVALID",
              message: "Permintaan tidak valid. Muat ulang halaman dan coba lagi.",
            },
          },
          { status: 403 }
        );
      }
    }

    // b. Validasi Session Cookie untuk semua route /api/* KECUALI webhook / callback OAuth
    if (!isWebhookOrCallback) {
      if (!sessionCookie) {
        return NextResponse.json(
          {
            error: {
              code: "SESSION_EXPIRED",
              message: "Sesi berakhir. Silakan login kembali.",
            },
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.next();
  }

  // 2. Redirect Middleware untuk Halaman UI
  // a. Jika sudah login dan mengakses /login atau /register -> redirect ke /dashboard
  if (
    sessionCookie &&
    AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // b. Jika belum login dan mengakses halaman yang dilindungi -> redirect ke /login
  const isProtectedPage = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!sessionCookie && isProtectedPage) {
    const fullPath = request.nextUrl.search ? `${pathname}${request.nextUrl.search}` : pathname;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", fullPath);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Pastikan cookie CSRF terpasang pada response untuk request non-API jika belum ada
  const response = NextResponse.next();
  const existingCsrfToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

  if (!existingCsrfToken) {
    const newCsrfToken = generateCsrfToken();
    response.cookies.set(CSRF_COOKIE_NAME, newCsrfToken, {
      httpOnly: CSRF_COOKIE_OPTIONS.httpOnly,
      secure: CSRF_COOKIE_OPTIONS.secure,
      sameSite: CSRF_COOKIE_OPTIONS.sameSite,
      maxAge: CSRF_COOKIE_OPTIONS.maxAge,
      path: CSRF_COOKIE_OPTIONS.path,
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)
     * - icons/* (PWA icons)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)",
  ],
};
