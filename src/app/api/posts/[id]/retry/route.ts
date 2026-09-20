import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { postManager, PostManagerError } from "@/lib/services/post-manager";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/posts/[id]/retry
 * Retry publish untuk target yang gagal.
 */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sesi berakhir." } },
      { status: 401 }
    );
  }

  const user = await authService.validateSession(sessionCookie);
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } },
      { status: 401 }
    );
  }

  try {
    await postManager.scheduleRetry(user.id, id);
    return NextResponse.json({ postId: id, status: "QUEUED" }, { status: 202 });
  } catch (err) {
    if (err instanceof PostManagerError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    console.error("[Posts] Retry failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Gagal menjadwalkan retry." } },
      { status: 500 }
    );
  }
}
