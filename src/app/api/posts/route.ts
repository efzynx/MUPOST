import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { postManager, PostManagerError } from "@/lib/services/post-manager";
import type { PostStatus, PlatformType } from "@/lib/db/schema";

/**
 * GET /api/posts
 * Query params: status[] (comma-separated), platform[] (comma-separated), page
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const { searchParams } = new URL(request.url);

  // Parse filters
  const statusParam = searchParams.get("status");
  const platformParam = searchParams.get("platform");
  const pageParam = searchParams.get("page");

  const status = statusParam
    ? (statusParam.split(",").filter(Boolean) as PostStatus[])
    : undefined;
  const platform = platformParam
    ? (platformParam.split(",").filter(Boolean) as PlatformType[])
    : undefined;
  const page = pageParam ? parseInt(pageParam, 10) : 1;

  try {
    const result = await postManager.listPosts(
      user.id,
      { status, platform },
      { page: isNaN(page) ? 1 : page }
    );

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    console.error("[Posts] List failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Gagal memuat daftar post." } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/posts
 * Body: { textContent, mediaUrls?, targetAccountIds, scheduledAt?, publishNow? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const post = await postManager.createPost(user.id, {
      textContent: String(body.textContent ?? ""),
      mediaUrls: Array.isArray(body.mediaUrls) ? body.mediaUrls : undefined,
      targetAccountIds: Array.isArray(body.targetAccountIds) ? body.targetAccountIds : [],
      scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : null,
      publishNow: body.publishNow === true,
      source: typeof body.source === "string" ? body.source : "FORM",
    });

    const statusCode = post.status === "QUEUED" ? 202 : 201;
    return NextResponse.json(
      { data: post, postId: post.id, status: post.status },
      { status: statusCode }
    );
  } catch (err) {
    if (err instanceof PostManagerError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message, details: err.details } },
        { status: err.statusCode }
      );
    }
    console.error("[Posts] Create failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Gagal membuat post." } },
      { status: 500 }
    );
  }
}
