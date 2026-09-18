import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      await authService.logout(sessionCookie);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[Logout Warning] Gagal membatalkan sesi:", err);
    }
  }

  const response = NextResponse.json(
    {
      success: true,
      redirect: "/login",
    },
    { status: 200 }
  );

  // Hapus cookie sesi dari browser
  response.cookies.delete(SESSION_COOKIE_NAME);

  return response;
}
