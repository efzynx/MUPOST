import { NextResponse, type NextRequest } from "next/server";
import { authService, AuthError } from "@/lib/services/auth-service";
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  CSRF_COOKIE_OPTIONS,
} from "@/lib/cookies";
import { generateCsrfToken } from "@/lib/csrf";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Email atau kata sandi tidak valid.",
          },
        },
        { status: 401 }
      );
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const result = await authService.login({ email, password, ipAddress });

    const response = NextResponse.json(
      {
        success: true,
        redirect: "/dashboard",
        user: result.user,
      },
      { status: 200 }
    );

    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
      secure: SESSION_COOKIE_OPTIONS.secure,
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      maxAge: SESSION_COOKIE_OPTIONS.maxAge,
      path: SESSION_COOKIE_OPTIONS.path,
    });

    const newCsrfToken = generateCsrfToken();
    response.cookies.set(CSRF_COOKIE_NAME, newCsrfToken, {
      httpOnly: CSRF_COOKIE_OPTIONS.httpOnly,
      secure: CSRF_COOKIE_OPTIONS.secure,
      sameSite: CSRF_COOKIE_OPTIONS.sameSite,
      maxAge: CSRF_COOKIE_OPTIONS.maxAge,
      path: CSRF_COOKIE_OPTIONS.path,
    });

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.statusCode }
      );
    }

    // eslint-disable-next-line no-console
    console.error("[Login Error]:", error);
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: "Terjadi kesalahan pada server. Silakan coba lagi nanti.",
        },
      },
      { status: 500 }
    );
  }
}
