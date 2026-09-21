import type { NextRequest } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { createRedisClient } from "@/lib/redis";
import {
  getPostEventsChannel,
  localPostEvents,
  type PostStatusEvent,
} from "@/lib/services/post-events";
import type { Redis } from "ioredis";

export const dynamic = "force-dynamic";

/**
 * GET /api/posts/stream
 * Server-Sent Events (SSE) endpoint untuk live update status postingan pengguna yang sedang aktif.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return new Response(
      JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Sesi berakhir." } }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const user = await authService.validateSession(sessionCookie);
  if (!user) {
    return new Response(
      JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream mungkin sudah ditutup oleh klien
        }
      };

      const sendComment = (comment: string) => {
        try {
          controller.enqueue(encoder.encode(`: ${comment}\n\n`));
        } catch {
          // Stream mungkin sudah ditutup oleh klien
        }
      };

      // 1. Kirim event koneksi awal (handshake)
      sendEvent("connected", {
        status: "connected",
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      // 2. Siapkan subscriber Redis terpisah untuk user ini
      let subscriber: Redis | null = null;
      const userChannel = getPostEventsChannel(user.id);

      try {
        subscriber = createRedisClient();
        await subscriber.subscribe(userChannel);

        subscriber.on("message", (channel, message) => {
          if (channel === userChannel) {
            try {
              const data = JSON.parse(message);
              sendEvent("post-status", data);
            } catch {
              // Abaikan format pesan tidak valid
            }
          }
        });
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.warn(
          "[SSE] Gagal menginisialisasi subscriber Redis, menggunakan fallback lokal:",
          err?.message || err
        );
      }

      // 3. Pasang listener event emitter lokal sebagai fallback (in-process)
      const localListener = (eventData: PostStatusEvent) => {
        if (eventData.userId === user.id) {
          sendEvent("post-status", eventData);
        }
      };
      localPostEvents.on("event", localListener);

      // 4. Heartbeat interval untuk menjaga koneksi tetap aktif di balik proxy/load balancer
      const heartbeatTimer = setInterval(() => {
        sendComment("keepalive");
      }, 15000);

      // 5. Bersihkan resource saat koneksi diputus oleh browser
      request.signal.addEventListener("abort", async () => {
        clearInterval(heartbeatTimer);
        localPostEvents.off("event", localListener);
        if (subscriber) {
          try {
            await subscriber.unsubscribe(userChannel);
            await subscriber.quit();
          } catch {
            // Abaikan error saat cleanup koneksi
          }
          subscriber = null;
        }
        try {
          controller.close();
        } catch {
          // Abaikan jika controller sudah tertutup
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
