import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { platformConnector } from "@/lib/services/platform-connector";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";

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

  const authUrl = await platformConnector.getMetaAuthUrl(user.id);
  return NextResponse.redirect(new URL(authUrl));
}
