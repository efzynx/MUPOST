import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { postManager, PostManagerError } from "@/lib/services/post-manager";
import {
  previewEngine,
  type PreviewResult,
} from "@/lib/services/preview-engine";

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * GET /api/posts/[id]/preview
 *
 * Mengambil post berdasarkan id, kemudian merender simulasi pratinjau
 * untuk semua platform target post tersebut.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;

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

    const previews: Record<string, PreviewResult> = {};

    const previewInput = {
      textContent: post.textContent,
      mediaUrls: post.mediaUrls ?? [],
    };

    // Render preview untuk setiap platform target
    for (const target of post.targets) {
      const input = {
        ...previewInput,
        accountName: target.accountName,
      };

      if (target.platform === "META_PAGE") {
        previews.facebook = previewEngine.renderFacebookPreview(input);
      } else if (target.platform === "INSTAGRAM") {
        previews.instagram = previewEngine.renderInstagramPreview(input);
      } else if (target.platform === "TIKTOK") {
        previews.tiktok = previewEngine.renderTikTokPreview(input);
      } else if (target.platform === "THREADS") {
        previews.threads = previewEngine.renderThreadsPreview(input);
      }
    }

    // Jika post belum punya target tapi ingin melihat default preview
    if (Object.keys(previews).length === 0) {
      previews.facebook = previewEngine.renderFacebookPreview(previewInput);
      previews.instagram = previewEngine.renderInstagramPreview(previewInput);
      previews.tiktok = previewEngine.renderTikTokPreview(previewInput);
      previews.threads = previewEngine.renderThreadsPreview(previewInput);
    }

    return NextResponse.json(
      {
        data: {
          postId: post.id,
          textContent: post.textContent,
          mediaUrls: post.mediaUrls,
          previews,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof PostManagerError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Gagal memuat pratinjau post." } },
      { status: 500 }
    );
  }
}
