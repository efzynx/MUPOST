import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { tokenHealthService } from "@/lib/services/token-health-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";

/**
 * POST /api/connect/health/refresh
 * Memicu refresh token secara proaktif untuk suatu akun terhubung.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const body = await request.json().catch(() => ({}));
    const { accountId } = body;

    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Parameter accountId diperlukan.",
          },
        },
        { status: 400 }
      );
    }

    const result = await tokenHealthService.refreshToken(user.id, accountId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Gagal memperbarui token.",
          health: result.health,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Token berhasil diperbarui.",
        newExpiresAt: result.newExpiresAt,
        health: result.health,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal.";
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
