import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { platformConnector } from "@/lib/services/platform-connector";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
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

  const accountId = params.id;
  const deleted = await platformConnector.disconnectAccount(user.id, accountId);

  if (!deleted) {
    return NextResponse.json(
      {
        error: {
          code: "ACCOUNT_NOT_FOUND",
          message: "Akun terhubung tidak ditemukan atau bukan milik Anda.",
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: true, message: "Koneksi akun berhasil dihapus." },
    { status: 200 }
  );
}
