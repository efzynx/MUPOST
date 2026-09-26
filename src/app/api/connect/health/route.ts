import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { tokenHealthService } from "@/lib/services/token-health-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";

/**
 * GET /api/connect/health
 * Mengambil ringkasan kesehatan token dan daftar peringatan masa berlaku token
 * untuk seluruh akun terhubung milik pengguna.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Sesi berakhir atau tidak ditemukan.",
        },
      },
      { status: 401 }
    );
  }

  const user = await authService.validateSession(sessionCookie);
  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Sesi tidak valid.",
        },
      },
      { status: 401 }
    );
  }

  try {
    const summary = await tokenHealthService.getUserTokensHealth(user.id);
    return NextResponse.json({ data: summary }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengambil status kesehatan token.";
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message,
        },
      },
      { status: 500 }
    );
  }
}
