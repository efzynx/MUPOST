import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { platformConnector } from "@/lib/services/platform-connector";
import { postManager } from "@/lib/services/post-manager";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { db } from "@/lib/db";
import { posts, postTargets } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

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

  try {
    // 1. Ambil akun terhubung
    const accounts = await platformConnector.getConnectedAccounts(user.id);

    // 2. Ambil agregat status post untuk user ini
    const statusCounts = await db
      .select({
        status: posts.status,
        count: sql<number>`count(*)::int`,
      })
      .from(posts)
      .where(eq(posts.userId, user.id))
      .groupBy(posts.status);

    type CountStatus = "TOTAL" | "PUBLISHED" | "SCHEDULED" | "QUEUED" | "DRAFT" | "FAILED" | "PARTIAL";
    const counts: Record<CountStatus, number> = {
      TOTAL: 0,
      PUBLISHED: 0,
      SCHEDULED: 0,
      QUEUED: 0,
      DRAFT: 0,
      FAILED: 0,
      PARTIAL: 0,
    };

    for (const row of statusCounts) {
      if (row.status in counts) {
        counts[row.status as CountStatus] = Number(row.count) || 0;
      }
      counts.TOTAL += Number(row.count) || 0;
    }

    // 3. Ambil statistik publikasi per platform dari target yang berstatus PUBLISHED
    const platformStats = await db
      .select({
        platform: postTargets.platform,
        count: sql<number>`count(*)::int`,
      })
      .from(postTargets)
      .innerJoin(posts, eq(postTargets.postId, posts.id))
      .where(eq(posts.userId, user.id))
      .groupBy(postTargets.platform);

    const platformDistribution: Record<string, number> = {
      META_PAGE: 0,
      INSTAGRAM: 0,
      TIKTOK: 0,
      THREADS: 0,
    };

    for (const row of platformStats) {
      if (row.platform in platformDistribution) {
        platformDistribution[row.platform] = Number(row.count) || 0;
      }
    }

    // 4. Ambil 5 postingan terakhir / terbaru
    const recentPostsResult = await postManager.listPosts(
      user.id,
      {},
      { page: 1 }
    );

    const recentPosts = recentPostsResult.posts.slice(0, 5);

    return NextResponse.json(
      {
        data: {
          accounts,
          stats: {
            totalPosts: counts.TOTAL,
            publishedPosts: counts.PUBLISHED,
            scheduledPosts: counts.SCHEDULED + counts.QUEUED,
            draftPosts: counts.DRAFT,
            failedPosts: counts.FAILED + counts.PARTIAL,
            platformDistribution,
          },
          recentPosts,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Dashboard] Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Gagal memuat data dashboard." } },
      { status: 500 }
    );
  }
}
