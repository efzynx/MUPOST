import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { postManager, PostManagerError } from "@/lib/services/post-manager";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/posts/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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
    const post = await postManager.getPost(user.id, id);
    return NextResponse.json({ data: post }, { status: 200 });
  } catch (err) {
    if (err instanceof PostManagerError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Gagal memuat post." } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/posts/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Body harus berformat JSON." } },
      { status: 400 }
    );
  }

  try {
    const post = await postManager.updatePost(user.id, id, {
      textContent: typeof body.textContent === "string" ? body.textContent : undefined,
      mediaUrls: Array.isArray(body.mediaUrls) ? body.mediaUrls : undefined,
      targetAccountIds: Array.isArray(body.targetAccountIds) ? body.targetAccountIds : undefined,
      scheduledAt:
        body.scheduledAt === null
          ? null
          : body.scheduledAt
            ? new Date(String(body.scheduledAt))
            : undefined,
    });

    return NextResponse.json({ data: post }, { status: 200 });
  } catch (err) {
    if (err instanceof PostManagerError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message, details: err.details } },
        { status: err.statusCode }
      );
    }
    console.error("[Posts] Update failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Gagal mengupdate post." } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posts/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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
    const searchParams = request.nextUrl.searchParams;
    const deleteOnPlatformsParam = searchParams.get("deleteOnPlatforms");
    const syncDeleteParam = searchParams.get("syncDelete");
    let deleteOnPlatforms =
      deleteOnPlatformsParam === "true" ||
      deleteOnPlatformsParam === "1" ||
      syncDeleteParam === "true" ||
      syncDeleteParam === "1";

    if (!deleteOnPlatforms && request.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = await request.json();
        if (body?.deleteOnPlatforms !== undefined) {
          deleteOnPlatforms = Boolean(body.deleteOnPlatforms);
        } else if (body?.syncDelete !== undefined) {
          deleteOnPlatforms = Boolean(body.syncDelete);
        }
      } catch {
        // Abaikan jika body kosong / bukan json
      }
    }

    const deleteResult = await postManager.deletePost(user.id, id, { deleteOnPlatforms });
    return NextResponse.json(deleteResult, { status: 200 });
  } catch (err) {
    if (err instanceof PostManagerError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    console.error("[Posts] Delete failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Gagal menghapus post." } },
      { status: 500 }
    );
  }
}
