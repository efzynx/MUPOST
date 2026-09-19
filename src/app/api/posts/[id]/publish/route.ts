import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { postManager, PostManagerError } from "@/lib/services/post-manager";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/posts/[id]/publish
 * Ubah status post ke QUEUED dan enqueue BullMQ job.
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
    await postManager.publishNow(user.id, id);
    return NextResponse.json(
      { postId: id, status: "QUEUED" },
      { status: 202 }
    );
  } catch (err) {
    if (err instanceof PostManagerError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    console.error("[Posts] Publish failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Gagal mempublikasikan post." } },
      { status: 500 }
    );
  }
}
