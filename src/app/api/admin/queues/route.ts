import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { queueMonitorService } from "@/lib/services/queue-monitor-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import type { JobType } from "bullmq";

/**
 * GET /api/admin/queues
 * Endpoint observabilitas BullMQ: metrik antrean (waiting, active, failed, completed, delayed)
 * serta daftar job terkini yang terproteksi autentikasi sesi.
 */
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

  const { searchParams } = new URL(request.url);
  const queueName = searchParams.get("queue") || undefined;
  const statusParam = searchParams.get("status") || "all";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const limitParam = parseInt(searchParams.get("limit") || "20", 10);

  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const limit = isNaN(limitParam) || limitParam < 1 ? 20 : Math.min(limitParam, 100);

  let types: JobType[];
  if (statusParam === "failed") {
    types = ["failed"];
  } else if (statusParam === "active") {
    types = ["active"];
  } else if (statusParam === "waiting") {
    types = ["waiting"];
  } else if (statusParam === "completed") {
    types = ["completed"];
  } else if (statusParam === "delayed") {
    types = ["delayed"];
  } else {
    types = ["failed", "active", "waiting", "delayed", "completed"];
  }

  try {
    const overview = await queueMonitorService.getOverviewMetrics();
    const jobsData = await queueMonitorService.getJobs({
      queueName: queueName || "publish-queue",
      types,
      page,
      limit,
    });

    return NextResponse.json(
      {
        metrics: overview.queues,
        summary: overview.summary,
        jobs: jobsData.jobs,
        pagination: {
          page: jobsData.page,
          limit: jobsData.limit,
          total: jobsData.total,
        },
        timestamp: overview.timestamp,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat status antrean BullMQ.";
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
