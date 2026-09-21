import { NextRequest } from "next/server";
import { GET } from "../stream/route";
import { authService } from "@/lib/services/auth-service";
import * as redisModule from "@/lib/redis";
import { localPostEvents } from "@/lib/services/post-events";

describe("GET /api/posts/stream (SSE endpoint)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should return 401 if session cookie is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/posts/stream");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 401 if session is invalid", async () => {
    jest.spyOn(authService, "validateSession").mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/posts/stream", {
      headers: {
        cookie: "session=invalid_token",
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("should return text/event-stream and stream connected event when authenticated", async () => {
    const mockUser = {
      id: "user-test-uuid",
      fullName: "Test User",
      email: "test@example.com",
    };
    jest.spyOn(authService, "validateSession").mockResolvedValueOnce(mockUser as any);

    // Mock redis client
    const mockSubscriber = {
      subscribe: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
      unsubscribe: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue("OK"),
    };
    jest.spyOn(redisModule, "createRedisClient").mockReturnValue(mockSubscriber as any);

    const abortController = new AbortController();
    const req = new NextRequest("http://localhost:3000/api/posts/stream", {
      headers: {
        cookie: "session=valid_token",
      },
      signal: abortController.signal,
    });

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    // Read the first chunk (connected event)
    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);

    expect(text).toContain("event: connected");
    expect(text).toContain('"userId":"user-test-uuid"');

    // Trigger local event and verify reader receives it
    const pushPromise = reader!.read();
    localPostEvents.emit("event", {
      type: "POST_STATUS_CHANGED",
      postId: "p-100",
      userId: "user-test-uuid",
      status: "PUBLISHING",
      timestamp: new Date().toISOString(),
    });

    const { value: secondChunk } = await pushPromise;
    const secondText = new TextDecoder().decode(secondChunk);
    expect(secondText).toContain("event: post-status");
    expect(secondText).toContain('"status":"PUBLISHING"');

    // Trigger abort to verify cleanup
    abortController.abort();
  });
});
