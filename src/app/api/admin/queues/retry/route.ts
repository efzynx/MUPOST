import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { queueMonitorService } from "@/lib/services/queue-monitor-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { PostManagerError } from "@/lib/services/post-manager";

/**
 * POST /api/admin/queues/retry
 * Mekanisme retry untuk job yang gagal pada antrean BullMQ
 * atau postingan yang mengalami kegagalan.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  try {
    const body = await request.json().catch(() => ({}));
    const { queueName, jobId, postId, retryAll } = body;

    // Skenario 1: Retry all failed jobs
    if (retryAll) {
      const result = await queueMonitorService.retryAllFailed(queueName);
      return NextResponse.json(result, { status: 200 });
    }

    // Skenario 2: Retry specific job
    if (jobId && queueName) {
      const result = await queueMonitorService.retryJob(queueName, jobId, user.id);
      return NextResponse.json(result, { status: 200 });
    }

    // Skenario 3: Retry post langsung via postId
    if (postId) {
      const result = await queueMonitorService.retryFailedPost(user.id, postId);
      return NextResponse.json(result, { status: 202 });
    }

    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message:
            "Harap sediakan parameter yang valid: (queueName & jobId), (retryAll: true), atau (postId).",
        },
      },
      { status: 400 }
    );
  } catch (err: unknown) {
    if (err instanceof PostManagerError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
          },
        },
        { status: err.statusCode }
      );
    }

    const message = err instanceof Error ? err.message : "Gagal memproses permintaan retry.";
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
